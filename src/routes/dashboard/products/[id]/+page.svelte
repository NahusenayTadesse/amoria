<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Trash from '@lucide/svelte/icons/trash-2';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import StockAdjustDialog from '$lib/components/dashboard/StockAdjustDialog.svelte';
	import { PRODUCT_KIND_LABELS, STOCK_REASON_META, STOCK_REF_LINKS, ethDay } from '$lib/stock';
	import { imageAdd } from '$lib/schemas/catalog';

	let { data } = $props();

	const p = $derived(data.product);
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

	const onDelete = () => {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			if (result.type === 'success') toast.success('Photo removed');
			else toast.error('Only an admin can remove photos');
			await update();
		};
	};
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

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between">
			<Card.Title>Photos</Card.Title>
			<FormDialog
				title="Add a photo"
				description="Compressed in your browser before it uploads. The first photo is the one on the shop."
				action="?/addImage"
				data={data.images.addForm}
				schema={imageAdd}
				triggerLabel="Add photo"
				submitLabel="Upload"
				multipart
				resetOnSuccess
			>
				{#snippet fields({ form, errors })}
					<FileUpload {form} name="fileName" placeholder="JPG, PNG or WebP" />
					<InputComp {form} {errors} name="alt" label="What it shows (for screen readers)" />
					<InputComp {form} {errors} name="altAm" label="What it shows, in Amharic" />
					<InputComp {form} {errors} name="sortOrder" type="number" label="Order (lower first)" />
				{/snippet}
			</FormDialog>
		</Card.Header>
		<Card.Content>
			{#if data.images.rows.length === 0}
				<p class="text-sm text-muted-foreground">
					No photos yet. The shop shows a wrapped-gift placeholder until you add one.
				</p>
			{:else}
				<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
					{#each data.images.rows as image (image.id)}
						{@const img = image as typeof image & {
							fileName: string;
							alt: string | null;
							sortOrder: number;
						}}
						<li class="group relative overflow-hidden rounded-md border">
							<img
								src={publicFileUrl(img.fileName)}
								alt={img.alt ?? ''}
								class="aspect-square w-full object-cover"
								loading="lazy"
							/>
							<p class="truncate px-2 py-1 text-xs text-muted-foreground">
								#{img.sortOrder}
								{img.alt ?? ''}
							</p>
							{#if data.isSuperAdmin}
								<form
									method="POST"
									action="?/deleteImage"
									use:enhance={onDelete}
									class="absolute top-1 right-1"
								>
									<input type="hidden" name="id" value={img.id} />
									<Button
										type="submit"
										size="icon"
										variant="destructive"
										class="size-8"
										aria-label="Remove this photo"
									>
										<Trash class="size-4" />
									</Button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>

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
