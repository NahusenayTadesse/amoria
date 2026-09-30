<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Truck from '@lucide/svelte/icons/truck';
	import Store from '@lucide/svelte/icons/store';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import {
		ORDER_ACTION_LABELS,
		ORDER_STATUS_LABELS,
		ORDER_TRANSITIONS,
		PAID
	} from '$lib/orderStatus';
	import { STOCK_REASON_META } from '$lib/stock';
	import { quick } from '$lib/quick';
	import PaymentsCard from '$lib/components/dashboard/PaymentsCard.svelte';

	let { data } = $props();

	const order = $derived(data.order);
	const nextSteps = $derived(ORDER_TRANSITIONS[order.status]);
	const waitingReceipts = $derived(
		data.payments.filter((p) => p.provider === 'bank_transfer' && p.status === 'initiated')
	);

	function confirmCancel(event: SubmitEvent) {
		const paid = PAID.includes(order.status);
		const text = paid
			? 'Cancel this paid order? Its stock goes back on the shelf. Refund the customer yourself.'
			: 'Cancel this order? Its stock goes back on the shelf.';
		if (!window.confirm(text)) event.preventDefault();
	}
</script>

<svelte:head>
	<title>{order.ref ?? `Order ${order.id}`} | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<a href={resolve('/dashboard/orders')} class="text-sm text-muted-foreground hover:underline"
			>Orders</a
		>
		<span class="text-muted-foreground">/</span>
		<h1 class="text-2xl font-semibold">{order.ref ?? `#${order.id}`}</h1>
		<Statuses status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
		{#if waitingReceipts.length}
			<Statuses status="initiated" label="Receipt to check" />
		{/if}
	</div>

	<!-- What can happen next, as buttons; the server enforces the same table. -->
	{#if data.can.manage && nextSteps.length}
		<div class="flex flex-wrap gap-2">
			{#each nextSteps as to (to)}
				<form
					method="POST"
					action="?/status"
					use:enhance={quick}
					onsubmit={to === 'cancelled' ? confirmCancel : undefined}
				>
					<input type="hidden" name="to" value={to} />
					<Button type="submit" variant={to === 'cancelled' ? 'outline' : 'default'} size="sm">
						{ORDER_ACTION_LABELS[to] ?? to}
					</Button>
				</form>
			{/each}
		</div>
	{/if}
	{#if order.status === 'paid_unfulfillable'}
		<p
			class="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100"
		>
			The payment arrived after the hold ran out and an item had sold out meanwhile. Call the
			customer to swap the item (adjust stock, then "Start preparing") or refund them and cancel.
		</p>
	{/if}

	<div class="grid gap-4 lg:grid-cols-3">
		<Card.Root class="lg:col-span-2">
			<Card.Header><Card.Title>Items</Card.Title></Card.Header>
			<Card.Content>
				<table class="w-full text-sm">
					<thead class="text-left text-muted-foreground">
						<tr
							><th class="py-2 font-medium">Item</th><th class="py-2 text-right font-medium">Qty</th
							><th class="py-2 text-right font-medium">Price</th><th
								class="py-2 text-right font-medium">Total</th
							></tr
						>
					</thead>
					<tbody class="divide-y">
						{#each data.items as item (item.id)}
							<tr>
								<td class="py-2"
									><a
										class="hover:underline"
										href={resolve('/dashboard/products/[id]', { id: String(item.productId) })}
										>{item.nameSnapshot}</a
									></td
								>
								<td class="py-2 text-right tabular-nums">{item.qty}</td>
								<td class="py-2 text-right tabular-nums">{formatETB(item.unitPrice)}</td>
								<td class="py-2 text-right tabular-nums">{formatETB(item.lineTotal)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot class="tabular-nums">
						<tr class="border-t"
							><td colspan="3" class="pt-2 text-right text-muted-foreground">Gifts</td><td
								class="pt-2 text-right">{formatETB(order.subtotal)}</td
							></tr
						>
						{#if order.fulfilment === 'delivery'}
							<tr
								><td colspan="3" class="text-right text-muted-foreground">Delivery</td><td
									class="text-right">{order.deliveryFee ? formatETB(order.deliveryFee) : 'Free'}</td
								></tr
							>
						{/if}
						<tr
							><td colspan="3" class="pt-1 text-right font-semibold">Total</td><td
								class="pt-1 text-right font-semibold">{formatETB(order.total)}</td
							></tr
						>
					</tfoot>
				</table>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Customer</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-3 text-sm">
				<div>
					<p class="font-medium">{order.contactName}</p>
					<a class="text-primary hover:underline" href="tel:{order.contactPhone}"
						>{order.contactPhone}</a
					>
					{#if order.contactEmail}<p class="text-muted-foreground">{order.contactEmail}</p>{/if}
				</div>
				<div class="flex items-start gap-2">
					{#if order.fulfilment === 'delivery'}
						<Truck class="mt-0.5 size-4 shrink-0" />
						<div>
							<p class="font-medium">Deliver to {order.deliveryAreaName}</p>
							<p class="text-muted-foreground">{order.deliveryAddress}</p>
						</div>
					{:else}
						<Store class="mt-0.5 size-4 shrink-0" />
						<p class="font-medium">Pickup from the shop</p>
					{/if}
				</div>
				{#if order.notes}
					<div>
						<p class="text-muted-foreground">Note from the customer</p>
						<p>{order.notes}</p>
					</div>
				{/if}
				<p class="text-muted-foreground">Placed {ethiopianDateTime(order.createdAt)}</p>
				{#if order.status === 'pending_payment' && order.holdExpiresAt}
					<p class="text-muted-foreground">Held until {ethiopianDateTime(order.holdExpiresAt)}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<PaymentsCard
		payments={data.payments}
		canRecord={data.canRecord}
		awaitingPayment={order.status === 'pending_payment'}
		amountDue={order.total}
		noun="order"
		paymentForm={data.paymentForm}
		rejectForm={data.rejectForm}
	/>

	{#if data.movements.length}
		<Card.Root>
			<Card.Header><Card.Title>Stock</Card.Title></Card.Header>
			<Card.Content>
				<ul class="text-sm">
					{#each data.movements as mv (mv.id)}
						<li class="flex justify-between py-1">
							<span>
								{STOCK_REASON_META[mv.reason]?.label ?? mv.reason}:
								<a
									class="hover:underline"
									href={resolve('/dashboard/products/[id]', { id: String(mv.productId) })}
								>
									{data.items.find((i) => i.productId === mv.productId)?.nameSnapshot ??
										`Product ${mv.productId}`}
								</a>
							</span>
							<span class="tabular-nums">{mv.delta > 0 ? `+${mv.delta}` : mv.delta}</span>
						</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
