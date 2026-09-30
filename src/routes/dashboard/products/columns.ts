import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';

/** Stock on hand, linking to the product's page where it is adjusted and its ledger read. */
export const extraColumns: ColumnDef<LookupRow>[] = [
	{ accessorKey: 'kindLabel', header: 'Kind' },
	{
		accessorKey: 'stockQty',
		header: 'In stock',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: String(row.original.stockQty),
				entity: 'product'
			})
	},
	{
		accessorKey: 'published',
		header: 'On the shop',
		cell: ({ row }) => (row.original.published && row.original.status ? 'Yes' : 'Hidden')
	}
];
