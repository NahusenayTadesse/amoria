<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';

	let { data } = $props();

	/** Where each tile goes when clicked. */
	const TARGETS: Record<string, string> = {
		handOver: '/dashboard/orders',
		receipts: '/dashboard/orders',
		studentReceipts: '/dashboard/school/students',
		paidToday: '/dashboard/orders?queue=all',
		low: '/dashboard/stock?level=low',
		expiring: '/dashboard/stock/expiry',
		reqWaiting: '/dashboard/requisitions',
		ordersOverdue: '/dashboard/purchasing'
	};
</script>

<svelte:head><title>Today | Amoria</title></svelte:head>

<div class="flex flex-col gap-4">
	<div>
		<h1 class="text-2xl font-semibold">Today</h1>
		<p class="text-muted-foreground">What needs doing now.</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each data.stats as stat (stat.key)}
			<a
				href={resolve(TARGETS[stat.key] as AppPath)}
				class="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				<StatCard {stat} amharicMoney={false} />
			</a>
		{/each}
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		{#if data.canOrders}
			<Card.Root>
				<Card.Header><Card.Title>Receipts to check</Card.Title></Card.Header>
				<Card.Content>
					{#if data.receipts.length === 0}
						<p class="text-sm text-muted-foreground">None waiting.</p>
					{:else}
						<ul class="divide-y text-sm">
							{#each data.receipts as r (r.orderId + '-' + r.createdAt)}
								<li class="flex justify-between gap-2 py-2">
									<a
										class="text-primary hover:underline"
										href={resolve('/dashboard/orders/[id]', { id: String(r.orderId) })}
										>{r.ref}, {r.name}</a
									>
									<span class="text-muted-foreground tabular-nums"
										>{formatETB(r.amount)}, {ethiopianDateTime(r.createdAt)}</span
									>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
		{#if data.canSchool}
			<Card.Root>
				<Card.Header><Card.Title>Student receipts to check</Card.Title></Card.Header>
				<Card.Content>
					{#if data.studentReceipts.length === 0}
						<p class="text-sm text-muted-foreground">None waiting.</p>
					{:else}
						<ul class="divide-y text-sm">
							{#each data.studentReceipts as r (r.registrationId + '-' + r.createdAt)}
								<li class="flex justify-between gap-2 py-2">
									<a
										class="text-primary hover:underline"
										href={resolve('/dashboard/school/students/[id]', {
											id: String(r.registrationId)
										})}>{r.ref}, {r.name}</a
									>
									<span class="text-muted-foreground tabular-nums"
										>{formatETB(r.amount)}, {ethiopianDateTime(r.createdAt)}</span
									>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
		{#if data.canStock}
			<Card.Root>
				<Card.Header><Card.Title>Low or out of stock</Card.Title></Card.Header>
				<Card.Content>
					{#if data.lowStock.length === 0}
						<p class="text-sm text-muted-foreground">Everything is above its warning level.</p>
					{:else}
						<ul class="divide-y text-sm">
							{#each data.lowStock as p (p.id)}
								<li class="flex justify-between py-2">
									<a
										class="hover:underline"
										href={resolve('/dashboard/products/[id]', { id: String(p.id) })}>{p.name}</a
									>
									<span
										class={[
											'tabular-nums',
											p.stockQty <= 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'
										]}
									>
										{p.stockQty <= 0 ? 'Out' : `${p.stockQty} left`}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</div>
