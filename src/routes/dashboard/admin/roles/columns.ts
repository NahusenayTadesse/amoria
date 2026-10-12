import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import type { RoleRow } from '$lib/server/services/staff';

export const columns: ColumnDef<RoleRow>[] = [
	{
		accessorKey: 'name',
		header: 'Role',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				entity: 'role'
			})
	},
	{ accessorKey: 'description', header: 'What it is for' },
	{ accessorKey: 'staff', header: 'Staff' },
	{
		accessorKey: 'permissions',
		header: 'Permissions',
		cell: ({ row }) => (row.original.isAdmin ? 'All, always' : String(row.original.permissions))
	},
	{
		accessorKey: 'isActive',
		header: 'Status',
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: row.original.isActive ? 'active' : 'inactive',
				label: row.original.isActive ? 'In use' : 'Switched off'
			})
	}
];
