<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import PhotoManager from '$lib/components/dashboard/PhotoManager.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import { containerRuleAdd, containerRuleEdit } from '$lib/schemas/catalog';
	import StockAdjustDialog from '$lib/components/dashboard/StockAdjustDialog.svelte';
	import { PRODUCT_KIND_LABELS, STOCK_REASON_META, STOCK_REF_LINKS, ethDay } from '$lib/stock';

	let { data } = $props();

	const p = $derived(data.product);

	const ruleFields: LookupField[] = [
		{
			name: 'categoryId',
			label: 'A category',
			type: 'reference',
			options: 'categoryId',
			display: 'category',
			required: false,
			placeholder: 'e.g. Flowers'
		},
		{
			name: 'productId',
			label: 'Or one gift',
			type: 'reference',
			options: 'productId',
			display: 'gift',
			picker: 'combo',
			required: false
		},
		{ name: 'maxQty', label: 'Holds at most', type: 'number' },
		{ name: 'minQty', label: 'Needs at least', type: 'number', required: false }
	];
	const low = $derived(p.stockQty <= data.lowStockAt);

	const stats = $derived([
		{
			key: 'onHand',
			label: 'In stock',
			value: p.stockQty,
			format: 'count' as const,
			group: 'stock',
			hint: 'On the shelf and free to sell',
			tone: low ? ('warning' as const) : ('neutral' as const)
		},
		{
			key: 'held',
			label: 'Held for unpaid orders',
			value: data.heldForUnpaid,
			format: 'count' as const,
			group: 'stock',
			hint: 'Returns to stock if they are not paid in time'
		},
		{
			key: 'worth',
			label: 'Worth',
			value: Math.round(p.stockQty * p.avgCost * 100) / 100,
			format: 'money' as const,
			group: 'stock',
			hint: `${formatETB(p.avgCost)} each on average`
		},
		{
			key: 'low',
			label: 'Low-stock warning at',
			value: data.lowStockAt,
			format: 'count' as const,
			group: 'stock',
			hint: p.lowStockThreshold === null ? 'Shop default' : 'Set on this product'
		}
	]);
</script>

<svelte:head>
	<title>{p.name} | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<a href={resolve('/dashboard/products')} class="text-sm text-muted-foreground hover:underline"
			>Products</a
		>
		<span class="text-muted-foreground">/</span>
		<h1 class="text-2xl font-semibold">{p.name}</h1>
		<Statuses
			status={p.isActive ? 'active' : 'inactive'}
			label={p.isActive ? (p.publishedAt ? 'On the shop' : 'Hidden') : 'Inactive'}
		/>
		{#if data.can.adjust}
			<div class="ml-auto">
				<StockAdjustDialog
					data={data.adjustForm}
					action="?/adjust"
					productName={p.name}
					onHand={p.stockQty}
					locations={data.locations}
				/>
			</div>
		{/if}
	</div>
	<p class="text-muted-foreground">
		{PRODUCT_KIND_LABELS[p.kind]}, {data.categoryName ?? 'no category'},
		{p.kind === 'gift'
			? formatETB(p.price)
			: p.kind === 'rental'
				? `${formatETB(p.dailyRate)} a day`
				: 'used, not sold'}
		{#if p.nameAm}<span lang="am">({p.nameAm})</span>{/if}
		{#if p.sku}<span class="ml-2">Code {p.sku}</span>{/if}
		{#if p.barcode}<span class="ml-2">Barcode {p.barcode}</span>{/if}
		{#if data.mainSupplier}<span class="ml-2">From {data.mainSupplier}</span>{/if}
	</p>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Where it is</Card.Title>
			<Card.Description>
				Units by location{p.trackLots ? ' and lot' : ''}. Stock in quarantine is set aside: it is
				not sold and is not counted in "In stock".
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.balances.length === 0}
				<p class="text-sm text-muted-foreground">Nothing anywhere yet.</p>
			{:else}
				<table class="w-full text-sm">
					<thead class="text-left text-muted-foreground">
						<tr>
							<th class="py-2 font-medium">Location</th>
							{#if p.trackLots}<th class="py-2 font-medium">Lot</th>
								<th class="py-2 font-medium">Expires</th>{/if}
							<th class="py-2 text-right font-medium">Units</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.balances as b, i (i)}
							<tr>
								<td class="py-2">
									{b.location}
									{#if b.kind === 'quarantine'}<span class="text-xs text-muted-foreground"
											>(set aside)</span
										>{/if}
								</td>
								{#if p.trackLots}
									<td class="py-2">
										{b.lot ?? '—'}
										{#if b.lotStatus && b.lotStatus !== 'available'}
											<span class="text-xs text-muted-foreground">({b.lotStatus})</span>
										{/if}
									</td>
									<td class="py-2">{b.expiryDate ? ethDay(b.expiryDate) : '—'}</td>
								{/if}
								<td class="py-2 text-right tabular-nums">{b.quantity} {p.unit}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if data.container}
		<PageSection
			title="What fits in it"
			hint="Give this gift rules to use it as a box, basket or wrap for bundles. A gift goes in only if a rule names it or its category, and it counts towards every rule that does: “Toys: at most 3” and “Teddy bear: at most 1” both apply to a teddy."
		>
			<LookupSection
				config={{ entity: 'Rule', plural: 'Rules', fields: ruleFields }}
				rows={data.container.rows}
				addForm={data.container.addForm}
				editForm={data.container.editForm}
				canDelete
				options={data.container.options}
				actions={{ add: '?/addRule', edit: '?/editRule', delete: '?/deleteRule' }}
				schemas={{ add: containerRuleAdd, edit: containerRuleEdit }}
			/>
			{#if data.container.usedBy.length}
				<p class="mt-3 text-sm text-muted-foreground">
					Used by
					{#each data.container.usedBy as b, i (b.id)}
						{i ? ', ' : ''}<a
							class="text-primary hover:underline"
							href={resolve('/dashboard/bundles/[id]', { id: String(b.id) })}>{b.name}</a
						>{b.type === 'custom' ? ' (built by customers)' : ''}
					{/each}.
				</p>
			{/if}
		</PageSection>
	{/if}

	<PhotoManager
		photos={data.images}
		canRemove={data.isSuperAdmin}
		mainUse="the one on the product's card and at the top of its page in the shop"
		emptyText="The shop shows a wrapped-gift placeholder until you add one."
	/>

	<Card.Root>
		<Card.Header>
			<Card.Title>Stock ledger</Card.Title>
			<Card.Description
				>Every change to this product's stock, newest first. Nothing here is ever edited or deleted.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if data.movements.length === 0}
				<p class="text-sm text-muted-foreground">
					No movements yet. Record opening stock or a delivery with "Adjust stock".
				</p>
			{:else}
				<table class="w-full text-sm">
					<thead class="text-left text-muted-foreground">
						<tr
							><th class="py-2 font-medium">When</th><th class="py-2 font-medium">What</th><th
								class="py-2 font-medium">Where</th
							><th class="py-2 font-medium">By</th><th class="py-2 text-right font-medium"
								>Change</th
							></tr
						>
					</thead>
					<tbody class="divide-y">
						{#each data.movements as mv (mv.id)}
							{@const link =
								mv.refType && mv.refId ? STOCK_REF_LINKS[mv.refType]?.(mv.refId) : undefined}
							<tr>
								<td class="py-2 whitespace-nowrap">{ethiopianDateTime(mv.createdAt)}</td>
								<td class="py-2">
									{STOCK_REASON_META[mv.reason]?.label ?? mv.reason}
									{#if link}<a class="text-primary hover:underline" href={resolve(link as AppPath)}
											>({mv.refType} {mv.refId})</a
										>{/if}
									{#if mv.note}<span class="text-muted-foreground">: {mv.note}</span>{/if}
								</td>
								<td class="py-2 text-muted-foreground">
									{mv.location}{mv.lot ? `, lot ${mv.lot}` : ''}
								</td>
								<td class="py-2 text-muted-foreground">{mv.by ?? 'System'}</td>
								<td
									class={[
										'py-2 text-right font-medium tabular-nums',
										mv.delta < 0 ? 'text-destructive' : 'text-green-700 dark:text-green-400'
									]}
								>
									{mv.delta > 0 ? `+${mv.delta}` : mv.delta}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
