import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { formatETB } from '@nahu/admin-kit/global';
import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import { ethDay } from '$lib/stock';
import { RENTER_ORDER_BADGE, RENTER_ORDER_LABELS, type RenterOrderStatus } from '$lib/rentalMarket';

export type RenterOrderRow = {
	id: number;
	ref: string | null;
	createdAt: Date;
	title: string;
	renterName: string;
	contactName: string;
	contactPhone: string;
	startDate: string;
	endDate: string;
	qty: number;
	origin: 'buy_now' | 'quote';
	total: number | null;
	status: RenterOrderStatus;
};

/**
 * Marketplace orders as a table, for a renter (`entity: 'renter_order'` → their order page) or
 * for staff (`withRenter`, no link: staff oversee, the renter acts).
 */
export function renterOrderColumns(
	options: { withRenter?: boolean } = {}
): ColumnDef<RenterOrderRow>[] {
	return [
		{
			accessorKey: 'createdAt',
			header: 'Received',
			cell: ({ row }) =>
				options.withRenter
					? `${row.original.ref ?? ''} ${ethiopianDateTime(row.original.createdAt)}`
					: renderComponent(DataTableLinks, {
							id: row.original.id,
							name: `${row.original.ref ?? ''}, ${ethiopianDateTime(row.original.createdAt)}`,
							entity: 'renter_order'
						})
		},
		...(options.withRenter
			? [{ accessorKey: 'renterName', header: 'Renter' } as ColumnDef<RenterOrderRow>]
			: []),
		{
			accessorKey: 'title',
			header: 'For',
			cell: ({ row }) => `${row.original.title} × ${row.original.qty}`
		},
		{
			accessorKey: 'contactName',
			header: 'Customer',
			cell: ({ row }) => `${row.original.contactName}, ${row.original.contactPhone}`
		},
		{
			accessorKey: 'startDate',
			header: 'When',
			cell: ({ row }) =>
				row.original.endDate === row.original.startDate
					? ethDay(row.original.startDate)
					: `${ethDay(row.original.startDate)} to ${ethDay(row.original.endDate)}`
		},
		{
			accessorKey: 'total',
			header: 'Total',
			cell: ({ row }) =>
				row.original.total == null ? 'Not priced yet' : formatETB(row.original.total, false)
		},
		{
			accessorKey: 'status',
			header: 'Status',
			cell: ({ row }) =>
				renderComponent(Statuses, {
					status: RENTER_ORDER_BADGE[row.original.status],
					label: RENTER_ORDER_LABELS[row.original.status]
				})
		}
	];
}
