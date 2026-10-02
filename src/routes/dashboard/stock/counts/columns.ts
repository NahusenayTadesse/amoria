import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { badge, ethDay } from '$lib/stock';

export type CountRow = {
	id: number;
	status: string;
	countDate: string;
	blind: boolean;
	location: string;
	category: string | null;
	lines: number;
	counted: number;
	adjustment: string | null;
};

export const columns: ColumnDef<CountRow>[] = [
	{
		accessorKey: 'id',
		header: 'Count',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: `Count #${row.original.id}`,
				entity: 'count'
			})
	},
	{ accessorKey: 'location', header: 'Location' },
	{
		accessorKey: 'category',
		header: 'Only',
		cell: ({ row }) => row.original.category ?? 'Everything'
	},
	{ accessorKey: 'countDate', header: 'Date', cell: ({ row }) => ethDay(row.original.countDate) },
	{
		id: 'progress',
		header: 'Counted',
		meta: { align: 'right' },
		cell: ({ row }) => `${row.original.counted} of ${row.original.lines}`
	},
	{
		accessorKey: 'blind',
		header: 'Blind',
		cell: ({ row }) => (row.original.blind ? 'Yes' : 'No')
	},
	{
		accessorKey: 'adjustment',
		header: 'Adjustment',
		cell: ({ row }) => row.original.adjustment ?? '—'
	},
	{
		accessorKey: 'statusLabel',
		header: 'Status',
		cell: ({ row }) => renderComponent(Statuses, badge(row.original.status))
	}
];
