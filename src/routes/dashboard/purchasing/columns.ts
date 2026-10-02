import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { formatETB } from '@nahu/admin-kit/global';
import { badge, ethDay } from '$lib/stock';

export type OrderRow = {
	id: number;
	number: string | null;
	status: string;
	orderDate: string;
	expectedDate: string | null;
	supplier: string;
	location: string;
	lines: number;
	value: number;
};

export const columns: ColumnDef<OrderRow>[] = [
	{
		accessorKey: 'number',
		header: 'Order',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.number ?? `Draft #${row.original.id}`,
				entity: 'purchase_order'
			})
	},
	{ accessorKey: 'supplier', header: 'Supplier' },
	{
		accessorKey: 'orderDate',
		header: 'Ordered',
		cell: ({ row }) => ethDay(row.original.orderDate)
	},
	{
		accessorKey: 'expectedDate',
		header: 'Expected',
		cell: ({ row }) => ethDay(row.original.expectedDate)
	},
	{ accessorKey: 'location', header: 'Deliver to' },
	{ accessorKey: 'lines', header: 'Lines', meta: { align: 'right' } },
	{
		accessorKey: 'value',
		header: 'Value',
		meta: { align: 'right' },
		cell: ({ row }) => formatETB(row.original.value)
	},
	{
		accessorKey: 'statusLabel',
		header: 'Status',
		cell: ({ row }) => renderComponent(Statuses, badge(row.original.status))
	}
];
