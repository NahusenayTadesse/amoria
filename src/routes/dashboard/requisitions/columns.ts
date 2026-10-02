import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { badge, ethDay } from '$lib/stock';

export type RequisitionRow = {
	id: number;
	number: string | null;
	status: string;
	purposeLabel: string;
	requester: string;
	requestDate: string;
	neededBy: string | null;
	store: string;
	lines: number;
};

export const columns: ColumnDef<RequisitionRow>[] = [
	{
		accessorKey: 'number',
		header: 'Requisition',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.number ?? `Draft #${row.original.id}`,
				entity: 'requisition'
			})
	},
	{ accessorKey: 'requester', header: 'Asked by' },
	{ accessorKey: 'purposeLabel', header: 'For' },
	{ accessorKey: 'store', header: 'From store' },
	{
		accessorKey: 'requestDate',
		header: 'Asked on',
		cell: ({ row }) => ethDay(row.original.requestDate)
	},
	{
		accessorKey: 'neededBy',
		header: 'Needed by',
		cell: ({ row }) => ethDay(row.original.neededBy)
	},
	{ accessorKey: 'lines', header: 'Lines', meta: { align: 'right' } },
	{
		accessorKey: 'statusLabel',
		header: 'Status',
		cell: ({ row }) => renderComponent(Statuses, badge(row.original.status))
	}
];
