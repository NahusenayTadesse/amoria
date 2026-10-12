import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { formatETB } from '@nahu/admin-kit/global';
import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import {
	LISTING_STATUS_BADGE,
	LISTING_STATUS_LABELS,
	PRICE_UNIT_LABELS,
	type ListingStatus,
	type PriceUnit
} from '$lib/rentalMarket';

export type ReviewRow = {
	id: number;
	name: string;
	renterName: string;
	renterId: number;
	categoryName: string;
	pricing: 'fixed' | 'quote';
	price: number | null;
	priceUnit: PriceUnit;
	status: ListingStatus;
	updatedAt: Date;
};

export const columns: ColumnDef<ReviewRow>[] = [
	{
		accessorKey: 'name',
		header: 'Rental',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				entity: 'renter_listing'
			})
	},
	{
		accessorKey: 'renterName',
		header: 'Renter',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.renterId,
				name: row.original.renterName,
				entity: 'renter'
			})
	},
	{ accessorKey: 'categoryName', header: 'Category' },
	{
		accessorKey: 'price',
		header: 'Price',
		cell: ({ row }) =>
			row.original.pricing === 'quote'
				? 'Quote only'
				: `${formatETB(row.original.price, false)} ${PRICE_UNIT_LABELS[row.original.priceUnit]}`
	},
	{
		accessorKey: 'updatedAt',
		header: 'Changed',
		cell: ({ row }) => ethiopianDateTime(row.original.updatedAt)
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: LISTING_STATUS_BADGE[row.original.status],
				label: LISTING_STATUS_LABELS[row.original.status]
			})
	}
];
