<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { formatETB } from '@nahu/admin-kit/global';
	import { STOCK_REASON_META, STOCK_REF_LINKS } from '$lib/stock';
	import StockTabs from '../StockTabs.svelte';

	let { data } = $props();

	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			accessorKey: 'createdAt',
			header: 'When',
			cell: ({ row }) => ethiopianDateTime(row.original.createdAt)
		},
		{
			accessorKey: 'product',
			header: 'Product',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.productId,
					name: row.original.product,
					entity: 'product'
				})
		},
		{ accessorKey: 'kindLabel', header: 'Kind' },
		{
			accessorKey: 'reason',
			header: 'What',
			cell: ({ row }) => STOCK_REASON_META[row.original.reason]?.label ?? row.original.reason
		},
		{
			id: 'where',
			header: 'Where',
			cell: ({ row }) =>
				row.original.lot
					? `${row.original.location}, lot ${row.original.lot}`
					: row.original.location
		},
		{
			accessorKey: 'delta',
			header: 'Change',
			meta: { align: 'right' },
			cell: ({ row }) =>
				row.original.delta > 0 ? `+${row.original.delta}` : String(row.original.delta)
		},
		{
			accessorKey: 'unitCost',
			header: 'Valued at',
			meta: { align: 'right' },
			cell: ({ row }) => formatETB(row.original.unitCost)
		},
		{
			id: 'source',
			header: 'Source',
			cell: ({ row }) => {
				const { refType, refId } = row.original;
				const link = refType && refId ? STOCK_REF_LINKS[refType]?.(refId) : undefined;
				if (link)
					return renderComponent(DataTableLinks, {
						id: refId,
						name: `${refType} ${refId}`,
						link: link.replace(/\d+$/, '')
					});
				return refType === 'count' ? 'Stock count' : '—';
			}
		},
		{ accessorKey: 'note', header: 'Note', cell: ({ row }) => row.original.note ?? '' },
		{ accessorKey: 'by', header: 'By', cell: ({ row }) => row.original.by ?? 'System' }
	];
</script>

<svelte:head>
	<title>Stock ledger | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<StockTabs current="ledger" />
	<p class="text-muted-foreground">
		Every change to every product's stock, newest first. Nothing here is ever edited or deleted.
	</p>
	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['reason', 'kindLabel']}
			facetLabels={{ reason: 'What', kindLabel: 'Kind' }}
			facetParams={{ kindLabel: 'kind' }}
			dateFilter="When"
			fileName="Stock ledger"
		/>
	{/key}
</div>
