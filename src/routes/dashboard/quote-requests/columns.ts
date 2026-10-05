import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import {
	CHANNEL_LABELS,
	QUOTE_REQUEST_LABELS,
	type QuoteRequestStatus
} from '$lib/quoteRequestStatus';
import QuoteRequestLink from './QuoteRequestLink.svelte';

export type QuoteRequestRow = {
	id: number;
	createdAt: Date;
	contactName: string;
	contactPhone: string;
	eventName: string | null;
	eventDate: string | null;
	guestCount: number | null;
	preferredChannel: string;
	status: QuoteRequestStatus;
};

export const columns: ColumnDef<QuoteRequestRow>[] = [
	{
		accessorKey: 'createdAt',
		header: 'Received',
		cell: ({ row }) =>
			renderComponent(QuoteRequestLink, {
				id: row.original.id,
				label: ethiopianDateTime(row.original.createdAt)
			})
	},
	{
		accessorKey: 'contactName',
		header: 'Customer',
		cell: ({ row }) => `${row.original.contactName}, ${row.original.contactPhone}`
	},
	{
		accessorKey: 'eventName',
		header: 'Event',
		cell: ({ row }) =>
			[row.original.eventName, row.original.eventDate].filter(Boolean).join(', ') || '—'
	},
	{
		accessorKey: 'guestCount',
		header: 'Guests',
		cell: ({ row }) => row.original.guestCount ?? '—'
	},
	{
		accessorKey: 'preferredChannel',
		header: 'Prefers',
		cell: ({ row }) =>
			CHANNEL_LABELS[row.original.preferredChannel] ?? row.original.preferredChannel
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: row.original.status,
				label: QUOTE_REQUEST_LABELS[row.original.status]
			})
	}
];
