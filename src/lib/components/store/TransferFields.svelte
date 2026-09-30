<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { birr } from '$lib/localized';

	type Account = { id: number; bankName: string; accountName: string; accountNumber: string };
	type Props = {
		/**
		 * The superforms `$form` store holding `bankAccountId` and `receipt` — the checkout's or the
		 * order page's. Typed as the kit's `FileUpload` takes it, since that is where it goes.
		 */
		form: ComponentProps<typeof FileUpload>['form'];
		accountError?: string;
		receiptError?: string;
		accounts: Account[];
		total: number;
	};

	let { form, accountError, receiptError, accounts, total }: Props = $props();

	/** What was just copied (`amount` or an account id), for the "Copied" state. */
	let copied = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Copies to the clipboard. The Clipboard API first; where it is missing (a page not on HTTPS,
	 * such as a phone testing over the LAN) or refuses (no permission — some in-app browsers, like
	 * Telegram's and Facebook's), the old `execCommand` route. "Copied" shows only if one worked.
	 */
	async function copy(key: string, text: string) {
		let ok = false;
		if (navigator.clipboard && window.isSecureContext) {
			ok = await navigator.clipboard.writeText(text).then(
				() => true,
				() => false
			);
		}
		if (!ok) ok = copyWithSelection(text);
		if (!ok) return; // Nothing to copy with: the number is on screen, large, to type by hand.

		copied = key;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = null), 2000);
	}

	function copyWithSelection(text: string): boolean {
		const field = document.createElement('textarea');
		field.value = text;
		field.setAttribute('readonly', '');
		field.style.position = 'fixed';
		field.style.opacity = '0';
		document.body.append(field);
		field.select();
		try {
			return document.execCommand('copy');
		} catch {
			return false;
		} finally {
			field.remove();
		}
	}

	function copyAccount(account: Account) {
		// Copying an account's number is choosing it: that is the one they are about to pay into.
		$form.bankAccountId = account.id;
		copy(String(account.id), account.accountNumber);
	}
</script>

<div class="flex flex-col gap-4">
	<!-- The amount first: it is the other thing a transfer needs typed exactly. -->
	<div class="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-secondary p-4">
		<div class="flex flex-col">
			<span class="text-sm text-muted-foreground">{m.checkout_total()}</span>
			<span class="display text-2xl font-bold tabular-nums">{birr(total)}</span>
		</div>
		<button
			type="button"
			onclick={() => copy('amount', total.toFixed(2))}
			class="flex h-10 items-center gap-1.5 rounded-full border border-foreground/70 px-4 text-sm font-semibold"
		>
			{#if copied === 'amount'}
				<Check class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
				{m.checkout_copied()}
			{:else}
				<Copy class="h-4 w-4" aria-hidden="true" />
				{m.checkout_copy_amount()}
			{/if}
		</button>
	</div>

	<p class="text-sm text-muted-foreground">{m.checkout_accounts_intro({ total: birr(total) })}</p>

	<!--
		Each account is both the details to transfer to and the choice of which one was used: the
		customer picks the card they paid into, and copies its number from the same place.
	-->
	<fieldset class="flex flex-col gap-2">
		<legend class="mb-2 text-sm font-medium text-foreground">{m.checkout_account_label()}</legend>
		{#each accounts as account (account.id)}
			{@const isCopied = copied === String(account.id)}
			<div
				class={[
					'rounded-[var(--radius)] border bg-card p-4 transition-colors',
					$form.bankAccountId === account.id
						? 'border-[var(--am-ribbon)] ring-1 ring-[var(--am-ribbon)]'
						: 'border-border'
				]}
			>
				<label class="flex cursor-pointer items-start gap-3">
					<input
						type="radio"
						name="bankAccountId"
						value={account.id}
						bind:group={$form.bankAccountId}
						class="mt-1 accent-[var(--am-ribbon)]"
					/>
					<span class="flex flex-col gap-0.5">
						<span class="text-sm font-semibold text-foreground">{account.bankName}</span>
						<span class="text-sm text-muted-foreground">{account.accountName}</span>
					</span>
				</label>

				<!-- The number, large, as one tap target: tap copies it (and picks this account). -->
				<button
					type="button"
					onclick={() => copyAccount(account)}
					aria-label={m.checkout_copy_number({ number: account.accountNumber })}
					class="mt-3 flex w-full items-center justify-between gap-3 rounded-[calc(var(--radius)-4px)] bg-secondary px-4 py-3 text-left hover:bg-accent"
				>
					<span class="text-lg font-semibold tracking-wide tabular-nums"
						>{account.accountNumber}</span
					>
					<span
						class={[
							'flex shrink-0 items-center gap-1.5 text-sm font-semibold',
							isCopied ? 'text-[var(--am-ribbon)]' : 'text-foreground'
						]}
					>
						{#if isCopied}
							<Check class="h-4 w-4" aria-hidden="true" />
							{m.checkout_copied()}
						{:else}
							<Copy class="h-4 w-4" aria-hidden="true" />
							{m.checkout_copy()}
						{/if}
					</span>
				</button>
			</div>
		{/each}
		{#if accountError}
			<p class="text-sm text-destructive" role="alert">{accountError}</p>
		{/if}
	</fieldset>

	<!-- Announces the copy to screen readers; the button text already shows it. -->
	<p class="sr-only" aria-live="polite">{copied ? m.checkout_copied() : ''}</p>

	<div class="flex flex-col gap-2">
		<span class="text-sm font-medium text-foreground">{m.checkout_receipt()}</span>
		<FileUpload
			{form}
			name="receipt"
			placeholder={m.checkout_receipt_placeholder()}
			labels={{ prompt: m.checkout_receipt() }}
		/>
		{#if receiptError}
			<p class="text-sm text-destructive" role="alert">{receiptError}</p>
		{/if}
	</div>
</div>
