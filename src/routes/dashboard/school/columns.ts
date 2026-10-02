import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';

/** Open classes and confirmed students, linking to the course's page where they are managed. */
export const extraColumns: ColumnDef<LookupRow>[] = [
	{
		accessorKey: 'openIntakes',
		header: 'Open classes',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: `${row.original.openIntakes} open, plan classes`,
				entity: 'course'
			})
	},
	{ accessorKey: 'confirmedStudents', header: 'Confirmed students' }
];
