import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDate } from '@nahu/admin-kit/tableCells';
import { localPhone } from '@nahu/admin-kit/phone';
import { RENTER_STATUS_BADGE, RENTER_STATUS_LABELS, type RenterStatus } from '$lib/rentalMarket';

export type RenterRow = {
	id: number;
	businessName: string;
	ownerName: string;
	email: string;
	phone: string;
	tinNumber: string;
	status: RenterStatus;
	autoPublish: boolean;
	createdAt: Date;
	live: number;
};

export const columns: ColumnDef<RenterRow>[] = [
	{
		accessorKey: 'businessName',
		header: 'Business',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.businessName,
				entity: 'renter'
			})
	},
	{
		accessorKey: 'ownerName',
		header: 'Owner',
		cell: ({ row }) =>
			`${row.original.ownerName}, ${localPhone(row.original.phone) ?? row.original.phone}`
	},
	{ accessorKey: 'tinNumber', header: 'TIN' },
	{ accessorKey: 'live', header: 'Live rentals' },
	{
		accessorKey: 'autoPublish',
		header: 'Posts',
		cell: ({ row }) => (row.original.autoPublish ? 'Without review' : 'Reviewed')
	},
	{
		accessorKey: 'createdAt',
		header: 'Signed up',
		cell: ({ row }) => ethiopianDate(row.original.createdAt)
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: RENTER_STATUS_BADGE[row.original.status],
				label: RENTER_STATUS_LABELS[row.original.status]
			})
	}
];
