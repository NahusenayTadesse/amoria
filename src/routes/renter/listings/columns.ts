import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { formatETB } from '@nahu/admin-kit/global';
import {
	LISTING_STATUS_BADGE,
	LISTING_STATUS_LABELS,
	PRICE_UNIT_LABELS,
	type ListingStatus,
	type PriceUnit
} from '$lib/rentalMarket';

export type ListingRow = {
	id: number;
	name: string;
	categoryName: string;
	pricing: 'fixed' | 'quote';
	price: number | null;
	priceUnit: PriceUnit;
	quantity: number;
	status: ListingStatus;
	reviewNote: string | null;
	photos: number;
};

/** A listing's price as the renter set it: "ETB 500.00 per day", or "Quote only". */
export function priceText(row: Pick<ListingRow, 'pricing' | 'price' | 'priceUnit'>) {
	if (row.pricing === 'quote') {
		return row.price ? `Quote only (from ${formatETB(row.price, false)})` : 'Quote only';
	}
	return `${formatETB(row.price, false)} ${PRICE_UNIT_LABELS[row.priceUnit]}`;
}

export const columns: ColumnDef<ListingRow>[] = [
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
	{ accessorKey: 'categoryName', header: 'Category' },
	{ accessorKey: 'price', header: 'Price', cell: ({ row }) => priceText(row.original) },
	{ accessorKey: 'quantity', header: 'How many' },
	{
		accessorKey: 'photos',
		header: 'Photos',
		cell: ({ row }) => (row.original.photos ? String(row.original.photos) : 'None yet')
	},
	{
		accessorKey: 'status',
		header: 'On the site',
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: LISTING_STATUS_BADGE[row.original.status],
				label: LISTING_STATUS_LABELS[row.original.status]
			})
	}
];
