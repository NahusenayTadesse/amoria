import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import { CHANNEL_LABELS, MESSAGE_LABELS, type QuoteRequestStatus } from '$lib/quoteRequestStatus';
import MessageLink from './MessageLink.svelte';

export type MessageRow = {
	id: number;
	createdAt: Date;
	contactName: string;
	contactPhone: string;
	message: string | null;
	preferredChannel: string;
	status: QuoteRequestStatus;
};

/** The first line of a message, cut short enough for a table cell. */
const preview = (text: string | null) => {
	const line = (text ?? '').split('\n')[0].trim();
	return line.length > 80 ? `${line.slice(0, 79)}…` : line || '—';
};

export const columns: ColumnDef<MessageRow>[] = [
	{
		accessorKey: 'createdAt',
		header: 'Received',
		cell: ({ row }) =>
			renderComponent(MessageLink, {
				id: row.original.id,
				label: ethiopianDateTime(row.original.createdAt)
			})
	},
	{
		accessorKey: 'contactName',
		header: 'From',
		cell: ({ row }) => `${row.original.contactName}, ${row.original.contactPhone}`
	},
	{
		accessorKey: 'message',
		header: 'Message',
		cell: ({ row }) => preview(row.original.message)
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
				label: MESSAGE_LABELS[row.original.status as keyof typeof MESSAGE_LABELS]
			})
	}
];
