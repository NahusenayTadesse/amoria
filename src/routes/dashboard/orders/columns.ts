import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import { formatETB } from '@nahu/admin-kit/global';
import { ORDER_STATUS_LABELS, type OrderStatus } from '$lib/orderStatus';

export type OrderRow = {
	id: number;
	ref: string | null;
	createdAt: Date;
	contactName: string;
	contactPhone: string;
	fulfilment: 'pickup' | 'delivery';
	deliveryAreaName: string | null;
	total: number;
	status: OrderStatus;
	receiptWaiting: boolean;
};

export const columns: ColumnDef<OrderRow>[] = [
	{
		accessorKey: 'ref',
		header: 'Order',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.ref ?? `#${row.original.id}`,
				entity: 'order'
			})
	},
	{
		accessorKey: 'createdAt',
		header: 'Placed',
		cell: ({ row }) => ethiopianDateTime(row.original.createdAt)
	},
	{
		accessorKey: 'contactName',
		header: 'Customer',
		cell: ({ row }) => `${row.original.contactName}, ${row.original.contactPhone}`
	},
	{
		accessorKey: 'fulfilment',
		header: 'Pickup / delivery',
		cell: ({ row }) =>
			row.original.fulfilment === 'delivery'
				? `Deliver: ${row.original.deliveryAreaName ?? '—'}`
				: 'Pickup'
	},
	{ accessorKey: 'total', header: 'Total', cell: ({ row }) => formatETB(row.original.total) },
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) =>
			row.original.receiptWaiting
				? renderComponent(Statuses, { status: 'initiated', label: 'Receipt to check' })
				: renderComponent(Statuses, {
						status: row.original.status,
						label: ORDER_STATUS_LABELS[row.original.status]
					})
	}
];
