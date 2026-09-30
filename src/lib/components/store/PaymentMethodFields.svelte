<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { m } from '$lib/paraglide/messages.js';
	import TransferFields from './TransferFields.svelte';

	type Account = { id: number; bankName: string; accountName: string; accountNumber: string };
	type Props = {
		/**
		 * The superforms `$form` store of a form with `method`, `bankAccountId` and `receipt`. Loosely
		 * typed for the reason the kit's `InputComp` gives: fields are read by name.
		 */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		form: Writable<Record<string, any>>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		errors: Writable<Record<string, any>>;
		accounts: Account[];
		/** What is owed, shown beside the accounts to transfer to. */
		total: number;
	};

	let { form, errors, accounts, total }: Props = $props();

	const canTransfer = $derived(accounts.length > 0);

	const options = $derived([
		{
			value: 'chapa',
			title: m.checkout_method_chapa(),
			hint: m.checkout_method_chapa_hint(),
			disabled: false
		},
		{
			value: 'transfer',
			title: m.checkout_method_transfer(),
			hint: canTransfer ? m.checkout_method_transfer_hint() : m.checkout_no_accounts(),
			disabled: !canTransfer
		}
	]);

	/** superforms nests a field's errors differently by type; this reads the first message of any. */
	function firstError(errors: unknown): string | undefined {
		if (Array.isArray(errors)) return errors[0];
		const nested = (errors as { _errors?: string[] } | undefined)?._errors;
		return nested?.[0];
	}
</script>

<!-- Online or by transfer: the last thing asked before a guest pays (§0 pillar 2, step three). -->
<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 text-sm font-medium">{m.checkout_method_label()}</legend>
	{#each options as option (option.value)}
		<label
			class={[
				'flex items-start gap-3 rounded-[var(--radius)] border bg-card p-4 transition-colors',
				option.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
				$form.method === option.value
					? 'border-[var(--am-ribbon)] ring-1 ring-[var(--am-ribbon)]'
					: 'border-border hover:border-foreground/40'
			]}
		>
			<input
				type="radio"
				name="method"
				value={option.value}
				bind:group={$form.method}
				disabled={option.disabled}
				class="mt-1 accent-[var(--am-ribbon)]"
			/>
			<span class="flex flex-col gap-0.5">
				<span class="text-sm font-semibold">{option.title}</span>
				<span class="text-sm text-muted-foreground">{option.hint}</span>
			</span>
		</label>
	{/each}
</fieldset>

{#if $form.method === 'transfer' && canTransfer}
	<TransferFields
		{form}
		accountError={firstError($errors.bankAccountId)}
		receiptError={firstError($errors.receipt)}
		{accounts}
		{total}
	/>
{/if}
