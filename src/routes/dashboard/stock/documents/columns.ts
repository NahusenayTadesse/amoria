import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { formatETB } from '@nahu/admin-kit/global';
import { badge, ethDay } from '$lib/stock';

export type DocumentRow = {
	id: number;
	number: string | null;
	type: string;
	typeLabel: string;
	status: string;
	docDate: string;
	from: string | null;
	to: string | null;
	supplier: string | null;
	party: string | null;
	total: number | null;
	lines: number;
};

export const columns: ColumnDef<DocumentRow>[] = [
	{
		accessorKey: 'number',
		header: 'Number',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.number ?? `Draft #${row.original.id}`,
				entity: 'document'
			})
	},
	{ accessorKey: 'typeLabel', header: 'Kind' },
	{ accessorKey: 'docDate', header: 'Date', cell: ({ row }) => ethDay(row.original.docDate) },
	{
		id: 'where',
		header: 'Where',
		cell: ({ row }) =>
			row.original.from && row.original.to
				? `${row.original.from} → ${row.original.to}`
				: (row.original.from ?? row.original.to ?? '—')
	},
	{
		id: 'who',
		header: 'Supplier / for',
		cell: ({ row }) => row.original.supplier ?? row.original.party ?? '—'
	},
	{ accessorKey: 'lines', header: 'Lines', meta: { align: 'right' } },
	{
		accessorKey: 'total',
		header: 'Total',
		meta: { align: 'right' },
		cell: ({ row }) => (row.original.total == null ? '—' : formatETB(row.original.total))
	},
	{
		accessorKey: 'statusLabel',
		header: 'Status',
		cell: ({ row }) => renderComponent(Statuses, badge(row.original.status))
	}
];
