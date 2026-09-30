<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import StockAdjustDialog from '$lib/components/dashboard/StockAdjustDialog.svelte';
	import AdjustButton from './AdjustButton.svelte';
	import StockTabs from './StockTabs.svelte';

	let { data } = $props();

	type Row = (typeof data.rows)[number];

	let adjusting = $state<Row | null>(null);
	let adjustOpen = $state(false);

	const LEVEL = {
		out: { status: 'failed', label: 'Out of stock' },
		low: { status: 'pending', label: 'Low' },
		ok: { status: 'success', label: 'OK' }
	} as const;

	// Columns are built once; whether the viewer may adjust does not change while they are here.
	// svelte-ignore state_referenced_locally
	const columns: ColumnDef<Row>[] = [
		{
			accessorKey: 'name',
			header: 'Product',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.id,
					name: row.original.name,
					entity: 'product'
				})
		},
		{ accessorKey: 'kindLabel', header: 'Kind' },
		{
			accessorKey: 'category',
			header: 'Category',
			cell: ({ row }) => row.original.category ?? '—'
		},
		{ accessorKey: 'stockQty', header: 'In stock' },
		{ accessorKey: 'held', header: 'Held for unpaid orders' },
		{
			accessorKey: 'level',
			header: 'Level',
			cell: ({ row }) => {
				const level = LEVEL[row.original.level as keyof typeof LEVEL] ?? LEVEL.ok;
				return renderComponent(Statuses, {
					status: level.status,
					label: `${level.label} (warn at ${row.original.threshold})`
				});
			}
		},
		...(data.canAdjust
			? [
					{
						id: 'adjust',
						header: '',
						cell: ({ row }) =>
							renderComponent(AdjustButton, {
								onclick: () => {
									adjusting = row.original;
									adjustOpen = true;
								}
							})
					} satisfies ColumnDef<Row>
				]
			: [])
	];
</script>

<svelte:head>
	<title>Stock | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<StockTabs current="levels" />
	<p class="text-muted-foreground">
		Everything the shop keeps, gifts and rental equipment alike. Sales take stock when an order is
		placed and give it back if it is not paid in time; everything else is recorded here.
	</p>

	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['kindLabel', 'level', 'category']}
			facetLabels={{ kindLabel: 'Kind', level: 'Level', category: 'Category' }}
			facetParams={{ kindLabel: 'kind', category: 'categoryId' }}
			fileName="Stock"
		/>
	{/key}
</div>

{#if adjusting}
	<StockAdjustDialog
		data={data.adjustForm}
		action="?/adjust"
		productId={adjusting.id}
		productName={adjusting.name}
		onHand={adjusting.stockQty}
		bind:open={adjustOpen}
		hideTrigger
	/>
{/if}
