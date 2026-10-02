import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import { formatETB } from '@nahu/admin-kit/global';
import { badge } from '$lib/stock';

export type ShiftRow = {
	id: number;
	status: string;
	openedAt: Date;
	closedAt: Date | null;
	cashier: string | null;
	location: string;
	floatAmount: number;
	expectedCash: number | null;
	countedCash: number | null;
	difference: number | null;
	sales: number;
};

export const columns: ColumnDef<ShiftRow>[] = [
	{
		accessorKey: 'id',
		header: 'Shift',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: `Shift #${row.original.id}`,
				entity: 'pos_shift'
			})
	},
	{ accessorKey: 'cashier', header: 'Cashier', cell: ({ row }) => row.original.cashier ?? '—' },
	{
		accessorKey: 'openedAt',
		header: 'Opened',
		cell: ({ row }) => ethiopianDateTime(row.original.openedAt)
	},
	{
		accessorKey: 'closedAt',
		header: 'Closed',
		cell: ({ row }) => (row.original.closedAt ? ethiopianDateTime(row.original.closedAt) : '—')
	},
	{ accessorKey: 'sales', header: 'Sales', meta: { align: 'right' } },
	{
		accessorKey: 'expectedCash',
		header: 'Cash expected',
		meta: { align: 'right' },
		cell: ({ row }) =>
			row.original.expectedCash == null ? '—' : formatETB(row.original.expectedCash)
	},
	{
		accessorKey: 'countedCash',
		header: 'Cash counted',
		meta: { align: 'right' },
		cell: ({ row }) =>
			row.original.countedCash == null ? '—' : formatETB(row.original.countedCash)
	},
	{
		accessorKey: 'difference',
		header: 'Difference',
		meta: { align: 'right' },
		cell: ({ row }) =>
			row.original.difference == null
				? '—'
				: row.original.difference === 0
					? 'None'
					: formatETB(row.original.difference)
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => renderComponent(Statuses, badge(row.original.status))
	}
];
