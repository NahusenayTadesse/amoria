<script lang="ts">
	import HiddenField from '@nahu/admin-kit/formComponents/HiddenField.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FileText from '@lucide/svelte/icons/file-text';
	import Mail from '@lucide/svelte/icons/mail';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Phone from '@lucide/svelte/icons/phone';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import type { AppPath } from '$lib/paths';
	import { quick } from '$lib/quick';
	import { ethDay } from '$lib/stock';
	import {
		PRICE_UNIT_LABELS,
		RENTER_ORDER_BADGE,
		RENTER_ORDER_LABELS,
		RENTER_ORDER_MOVES
	} from '$lib/rentalMarket';
	import { reasonSchema, renterReceiptRejectSchema, sendQuoteSchema } from '$lib/schemas/renters';

	let { data } = $props();

	const order = $derived(data.order);
	const moves = $derived(RENTER_ORDER_MOVES[order.status]);
	const digits = $derived(order.contactPhone.replace(/\D/g, ''));
	const money = (amount: number | null) => formatETB(amount, false);

	let rejectOpen = $state(false);
	let rejecting = $state(0);

	const RECEIPT_LABELS: Record<string, string> = {
		submitted: 'Waiting for you',
		accepted: 'Accepted',
		rejected: 'Turned down'
	};
	const RECEIPT_BADGE: Record<string, string> = {
		submitted: 'pending',
		accepted: 'success',
		rejected: 'rejected'
	};

	const details = $derived(
		[
			[
				'When',
				order.endDate === order.startDate
					? ethDay(order.startDate)
					: `${ethDay(order.startDate)} to ${ethDay(order.endDate)}`
			],
			['How many', String(order.qty)],
			['Hours', order.hours ? String(order.hours) : null],
			['Where', order.venue],
			['How it started', order.origin === 'quote' ? 'Asked for a quote' : 'Booked at your price'],
			[
				'Price',
				order.unitPrice != null && order.priceUnit
					? `${money(order.unitPrice)} ${PRICE_UNIT_LABELS[order.priceUnit]}`
					: null
			]
		].filter(([, value]) => value)
	);
</script>

<div class="flex max-w-4xl flex-col gap-4">
	<PageHeader
		eyebrow={order.ref ?? 'Order'}
		title="{order.titleSnapshot}, for {order.contactName}"
		tabTitle="{order.ref} | Amoria renters"
	>
		{#snippet badges()}
			<Statuses
				status={RENTER_ORDER_BADGE[order.status]}
				label={RENTER_ORDER_LABELS[order.status]}
			/>
		{/snippet}
		<p class="text-sm text-muted-foreground">
			Received {ethiopianDateTime(order.createdAt)}
			<a href={resolve('/renter/orders' as AppPath)} class="ml-2 hover:underline">All orders</a>
		</p>
		{#snippet actions()}
			{#if moves.includes('quoted')}
				<FormDialog
					title={order.status === 'quoted' ? 'Change your quote' : 'Send a quote'}
					description="Your price for the whole request. The customer sees it with your note, accepts, and pays you by transfer."
					action="?/quote"
					data={data.quoteForm}
					schema={sendQuoteSchema}
					triggerLabel={order.status === 'quoted' ? 'Change quote' : 'Send quote'}
					submitLabel="Send quote"
				>
					{#snippet fields({ form, errors })}
						<InputComp
							{form}
							{errors}
							name="subtotal"
							type="number"
							step="0.01"
							min="0"
							label="Price (ETB)"
						/>
						<InputComp
							{form}
							{errors}
							name="deposit"
							type="number"
							step="0.01"
							min="0"
							label="Refundable deposit (ETB)"
							description="Added on top; 0 for none."
						/>
						<InputComp
							{form}
							{errors}
							name="validUntil"
							type="date"
							label="Customer can accept until"
						/>
						<InputComp
							{form}
							{errors}
							name="note"
							type="textarea"
							rows={4}
							label="Note to the customer"
							description="What is included, delivery, set-up, what you need from them."
						/>
					{/snippet}
				</FormDialog>
			{/if}
			{#if moves.includes('out')}
				<form method="POST" action="?/out" use:enhance={quick}>
					<Button type="submit" variant="outline">Handed over</Button>
				</form>
			{/if}
			{#if moves.includes('completed')}
				<form method="POST" action="?/complete" use:enhance={quick}>
					<Button type="submit">{order.status === 'out' ? 'Returned: complete' : 'Complete'}</Button
					>
				</form>
			{/if}
			{#if moves.includes('declined')}
				<FormDialog
					title="Decline this request"
					description="The customer sees your reason. Be kind: they may book with you another time."
					action="?/decline"
					data={data.reasonForm}
					schema={reasonSchema}
					triggerLabel="Decline"
					submitLabel="Decline"
				>
					{#snippet fields({ form, errors })}
						<InputComp
							{form}
							{errors}
							name="reason"
							type="textarea"
							rows={3}
							label="Why (e.g. already booked on those days)"
						/>
					{/snippet}
				</FormDialog>
			{/if}
			{#if moves.includes('cancelled')}
				<FormDialog
					title="Cancel this booking"
					description={order.paidAt
						? 'They have paid you: return their money yourself. The customer sees your reason.'
						: 'The customer sees your reason.'}
					action="?/cancel"
					data={data.reasonForm}
					schema={reasonSchema}
					triggerLabel="Cancel booking"
					submitLabel="Cancel booking"
				>
					{#snippet fields({ form, errors })}
						<InputComp {form} {errors} name="reason" type="textarea" rows={3} label="Why" />
					{/snippet}
				</FormDialog>
			{/if}
		{/snippet}
	</PageHeader>

	{#if order.status === 'quote_requested'}
		<Notice tone="warning" title="They are waiting for your price.">
			Check the dates, then send a quote, or decline if you cannot do it.
		</Notice>
	{:else if order.status === 'payment_review'}
		<Notice tone="warning" title="Check the receipt below.">
			Look for the money in your account first. Accept it only once it has arrived.
		</Notice>
	{:else if order.status === 'quoted'}
		<Notice tone="info" title="Quote sent.">
			Valid until {ethDay(order.validUntil)}. The customer accepts it on their page and pays you.
		</Notice>
	{:else if order.status === 'pending_payment'}
		<Notice tone="info" title="Waiting for the customer to pay.">
			They see your bank accounts and send you the receipt here.
		</Notice>
	{/if}

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header><Card.Title>The request</Card.Title></Card.Header>
			<Card.Content>
				<dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
					{#each details as [label, value] (label)}
						<div>
							<dt class="text-sm text-muted-foreground">{label}</dt>
							<dd class="font-medium">{value}</dd>
						</div>
					{/each}
				</dl>
				{#if order.message}
					<p class="mt-4 border-t pt-4 whitespace-pre-line">{order.message}</p>
				{/if}
				{#if data.listingSlug}
					<a
						href={resolve(`/rentals/${data.listingSlug}` as AppPath)}
						target="_blank"
						class="mt-4 inline-block text-sm text-primary hover:underline"
						>See the rental on the site</a
					>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>The customer</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<p class="font-medium">{order.contactName}</p>
				<div class="flex flex-wrap gap-2">
					<Button href="tel:{order.contactPhone}" variant="outline" size="sm"
						><Phone class="mr-1.5 size-4" />{order.contactPhone}</Button
					>
					<Button
						href="https://wa.me/{digits}"
						target="_blank"
						rel="noopener noreferrer"
						variant="outline"
						size="sm"><MessageCircle class="mr-1.5 size-4" />WhatsApp</Button
					>
					{#if order.contactEmail}
						<Button href="mailto:{order.contactEmail}" variant="outline" size="sm"
							><Mail class="mr-1.5 size-4" />{order.contactEmail}</Button
						>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header><Card.Title>Money</Card.Title></Card.Header>
		<Card.Content>
			{#if order.total == null}
				<p class="text-sm text-muted-foreground">Not priced yet: send a quote.</p>
			{:else}
				<dl class="grid max-w-sm grid-cols-2 gap-y-1 text-sm">
					<dt class="text-muted-foreground">Price</dt>
					<dd class="text-right">{money(order.subtotal)}</dd>
					{#if order.deposit}
						<dt class="text-muted-foreground">Refundable deposit</dt>
						<dd class="text-right">{money(order.deposit)}</dd>
					{/if}
					<dt class="font-semibold">Total</dt>
					<dd class="text-right font-semibold">{money(order.total)}</dd>
				</dl>
				{#if order.renterNote}
					<p class="mt-3 border-t pt-3 text-sm whitespace-pre-line">
						<span class="text-muted-foreground">Your note:</span>
						{order.renterNote}
					</p>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Payment receipts</Card.Title>
			<Card.Description>What the customer sent after transferring to you.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.receipts.length === 0}
				<p class="text-sm text-muted-foreground">None yet.</p>
			{:else}
				<ul class="divide-y text-sm">
					{#each data.receipts as r (r.id)}
						<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
							<div class="min-w-48 flex-1">
								<p class="font-medium">
									{money(r.amount)}
									<span class="font-normal text-muted-foreground"
										>to {r.bankName} {r.accountNumber}</span
									>
								</p>
								<p class="text-muted-foreground">{ethiopianDateTime(r.createdAt)}</p>
								{#if r.reviewNote}<p class="text-destructive">Turned down: {r.reviewNote}</p>{/if}
							</div>
							<Statuses status={RECEIPT_BADGE[r.status]} label={RECEIPT_LABELS[r.status]} />
							<a
								href={resolve(`/renter/files/${r.receiptFile}` as AppPath)}
								target="_blank"
								rel="noopener"
								class="flex items-center gap-1 text-primary hover:underline"
							>
								<FileText class="size-4" /> Open receipt
							</a>
							{#if r.status === 'submitted'}
								<form method="POST" action="?/acceptReceipt" use:enhance={quick}>
									<HiddenField name="paymentId" value={r.id} />
									<Button type="submit" size="sm">Money arrived: accept</Button>
								</form>
								<Button
									size="sm"
									variant="outline"
									onclick={() => ((rejecting = r.id), (rejectOpen = true))}>Turn down</Button
								>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<FormDialog
	title="Turn down this receipt"
	description="The customer sees your reason and can pay again."
	action="?/rejectReceipt"
	data={data.rejectForm}
	schema={renterReceiptRejectSchema}
	bind:open={rejectOpen}
	seed={{ paymentId: rejecting }}
	hideTrigger
	submitLabel="Turn down"
>
	{#snippet fields({ form, errors })}
		<InputComp {form} {errors} name="paymentId" type="hidden" />
		<InputComp
			{form}
			{errors}
			name="reason"
			type="textarea"
			rows={3}
			label="Why (not in my account, the amount is short…)"
		/>
	{/snippet}
</FormDialog>
