<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { m } from '$lib/paraglide/messages.js';
	import { birr } from '$lib/localized';
	import { transferSchema } from '$lib/schemas/checkout';
	import TransferFields from './TransferFields.svelte';

	type Account = { id: number; bankName: string; accountName: string; accountNumber: string };
	type Props = {
		/** What is owed, from the database. */
		total: number;
		accounts: Account[];
		/** The status page's `transferForm`. */
		data: SuperValidated<Record<string, unknown>>;
		/** The pay-with-Chapa button. */
		chapaLabel?: string;
		/** The send-the-receipt button. */
		sendLabel?: string;
	};

	let { total, accounts, data, chapaLabel, sendLabel }: Props = $props();

	// Set up once from the initial form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data, transferSchema, {
		dataType: 'form'
	});

	/** superforms nests a field's errors differently by type; this reads the first message of any. */
	function firstError(errors: unknown): string | undefined {
		if (Array.isArray(errors)) return errors[0];
		const nested = (errors as { _errors?: string[] } | undefined)?._errors;
		return nested?.[0];
	}
</script>

<!--
	The two ways to pay a record from its own page (§7): Chapa, then a transfer with its receipt.
	The actions are `pay` and `transfer` from `payActions`, on whatever page hosts this.
-->

<!-- A plain post: the server answers with a redirect to Chapa, no JavaScript needed. -->
<form method="POST" action="?/pay" class="mt-6">
	<button
		type="submit"
		class="h-12 w-full rounded-full bg-[var(--am-ribbon)] px-6 text-sm font-semibold text-white sm:w-auto"
	>
		{chapaLabel ?? m.order_pay_chapa({ total: birr(total) })}
	</button>
</form>

{#if accounts.length}
	<section class="mt-10 border-t border-border pt-8">
		<h2 class="display text-xl font-bold">{m.order_pay_transfer_heading()}</h2>
		<form
			method="POST"
			action="?/transfer"
			enctype="multipart/form-data"
			use:enhance
			class="mt-4 flex flex-col gap-5"
		>
			<TransferFields
				{form}
				accountError={firstError($errors.bankAccountId)}
				receiptError={firstError($errors.receipt)}
				{accounts}
				{total}
			/>
			<button
				type="submit"
				disabled={$delayed}
				class="h-12 rounded-full bg-foreground px-6 text-sm font-semibold text-background disabled:opacity-60 sm:self-start"
			>
				{$delayed ? `${m.checkout_placing()}…` : (sendLabel ?? m.order_send_receipt())}
			</button>
		</form>
	</section>
{/if}
