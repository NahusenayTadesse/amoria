<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import FileText from '@lucide/svelte/icons/file-text';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { quick } from '$lib/quick';
	import { manualPaymentSchema, rejectReceiptSchema } from '$lib/schemas/dashboard';

	type PaymentRow = {
		id: number;
		provider: string;
		providerRef: string | null;
		status: string;
		amount: number;
		receiptFile: string | null;
		createdAt: Date;
		bankName: string | null;
		accountNumber: string | null;
		recordedBy: string | null;
		note: string | null;
	};

	/* eslint-disable @typescript-eslint/no-explicit-any -- the kit's FormDialog takes the same loose form */
	type Props = {
		payments: PaymentRow[];
		/** May this staff member confirm, reject and record payments (`payments.record`)? */
		canRecord: boolean;
		/** Is the record still waiting for payment? Only then can one be recorded by hand. */
		awaitingPayment: boolean;
		/** What is owed, for the record-a-payment dialog. */
		amountDue: number;
		/** What the record is called: "order", "registration". */
		noun: string;
		paymentForm: SuperValidated<Record<string, unknown>, any, any>;
		rejectForm: SuperValidated<Record<string, unknown>, any, any>;
	};

	let { payments, canRecord, awaitingPayment, amountDue, noun, paymentForm, rejectForm }: Props =
		$props();

	let rejectOpen = $state(false);
	let rejecting = $state<number | null>(null);

	const PAYMENT_STATUS_LABELS: Record<string, string> = {
		initiated: 'Waiting for check',
		success: 'Received',
		failed: 'Failed',
		cancelled: 'Abandoned'
	};

	const PROVIDER_LABELS: Record<string, string> = {
		chapa: 'Chapa',
		bank_transfer: 'Bank transfer',
		telebirr: 'Telebirr',
		cash: 'Cash'
	};
</script>

<!--
	A record's payments (§7 "Manual payments"): what came in, transfer receipts to check, and cash or
	transfers staff took themselves. The actions are `confirmReceipt`, `rejectReceipt` and
	`recordPayment` from `paymentAdminActions`, on whatever page hosts this.
-->
<Card.Root>
	<Card.Header class="flex flex-row items-center justify-between">
		<Card.Title>Payments</Card.Title>
		{#if canRecord && awaitingPayment}
			<FormDialog
				title="Record a payment"
				description="Money taken in person, or a transfer you have already seen arrive. It is recorded for the full {formatETB(
					amountDue
				)} and the {noun} becomes paid."
				action="?/recordPayment"
				data={paymentForm}
				schema={manualPaymentSchema}
				triggerLabel="Record payment"
				submitLabel="Record payment"
				multipart
			>
				{#snippet fields({ form, errors })}
					<InputComp
						{form}
						{errors}
						name="provider"
						type="select"
						label="How they paid"
						items={[
							{ value: 'cash', name: 'Cash' },
							{ value: 'bank_transfer', name: 'Bank transfer' },
							{ value: 'telebirr', name: 'Telebirr' }
						]}
					/>
					<InputComp
						{form}
						{errors}
						name="reference"
						label="Reference (FT number, Telebirr ID), if any"
					/>
					<FileUpload
						{form}
						name="receipt"
						placeholder="Receipt photo or PDF, if any (up to 10 MB)"
					/>
				{/snippet}
			</FormDialog>
		{/if}
	</Card.Header>
	<Card.Content>
		{#if payments.length === 0}
			<p class="text-sm text-muted-foreground">No payment attempts yet.</p>
		{:else}
			<ul class="divide-y text-sm">
				{#each payments as p (p.id)}
					<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
						<div class="min-w-48 flex-1">
							<p class="font-medium">
								{PROVIDER_LABELS[p.provider] ?? p.provider}, {formatETB(p.amount)}
								{#if p.bankName}<span class="font-normal text-muted-foreground">
										to {p.bankName} {p.accountNumber}</span
									>{/if}
							</p>
							<p class="text-muted-foreground">
								{ethiopianDateTime(p.createdAt)}
								{#if p.providerRef}, ref {p.providerRef}{/if}
								{#if p.recordedBy}, by {p.recordedBy}{/if}
							</p>
							{#if p.note}<p class="text-destructive">Rejected: {p.note}</p>{/if}
						</div>
						<Statuses
							status={p.status}
							label={p.provider === 'chapa' && p.status === 'initiated'
								? 'Not finished on Chapa'
								: PAYMENT_STATUS_LABELS[p.status]}
						/>
						{#if p.receiptFile}
							<a
								href={resolve(fileUrl(p.receiptFile) as AppPath)}
								target="_blank"
								rel="noopener"
								class="flex items-center gap-1 text-primary hover:underline"
							>
								<FileText class="size-4" /> Receipt
							</a>
						{/if}
						{#if canRecord && p.provider === 'bank_transfer' && p.status === 'initiated'}
							<form method="POST" action="?/confirmReceipt" use:enhance={quick}>
								<input type="hidden" name="paymentId" value={p.id} />
								<Button type="submit" size="sm">Money arrived: confirm</Button>
							</form>
							<Button
								size="sm"
								variant="outline"
								onclick={() => ((rejecting = p.id), (rejectOpen = true))}>Reject</Button
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>

<FormDialog
	title="Reject this receipt"
	description="The customer can pay again: the {noun} gets a fresh hold."
	action="?/rejectReceipt"
	data={rejectForm}
	schema={rejectReceiptSchema}
	bind:open={rejectOpen}
	seed={{ paymentId: rejecting ?? 0 }}
	hideTrigger
	submitLabel="Reject receipt"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="paymentId" value={values.paymentId} />
		<InputComp
			{form}
			{errors}
			name="reason"
			type="textarea"
			rows={3}
			label="Why (the amount did not match, not on the statement…)"
		/>
	{/snippet}
</FormDialog>
