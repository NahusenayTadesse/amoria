import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';
import { formatETB } from '@nahu/admin-kit/global';

/** What is in each bundle and what it sells for, linking to the page where its contents are set. */
export const extraColumns: ColumnDef<LookupRow>[] = [
	{ accessorKey: 'kindLabel', header: 'Kind' },
	{
		accessorKey: 'itemCount',
		header: 'Gifts in it',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name:
					row.original.itemCount === null
						? 'Customers choose — open'
						: row.original.itemCount
							? `${row.original.itemCount} — open`
							: 'None yet — add some',
				entity: 'bundle'
			})
	},
	{
		accessorKey: 'price',
		header: 'Price',
		cell: ({ row }) => (row.original.price == null ? '—' : formatETB(Number(row.original.price)))
	},
	{
		accessorKey: 'sets',
		header: 'Can sell',
		cell: ({ row }) => (row.original.broken ? 'Not as it stands — open' : String(row.original.sets))
	},
	{
		accessorKey: 'published',
		header: 'On the shop',
		cell: ({ row }) => (row.original.published && row.original.status ? 'Yes' : 'Hidden')
	}
];
