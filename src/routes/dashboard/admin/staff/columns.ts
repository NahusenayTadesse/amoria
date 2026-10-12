import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDate } from '@nahu/admin-kit/tableCells';
import { localPhone } from '@nahu/admin-kit/phone';
import type { StaffRow } from '$lib/server/services/staff';

export const columns: ColumnDef<StaffRow>[] = [
	{
		accessorKey: 'name',
		header: 'Name',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				entity: 'staff'
			})
	},
	{ accessorKey: 'email', header: 'Email' },
	{
		accessorKey: 'phone',
		header: 'Phone',
		cell: ({ row }) => localPhone(row.original.phone) ?? ''
	},
	{
		accessorKey: 'roleName',
		header: 'Role',
		cell: ({ row }) =>
			row.original.roleId
				? renderComponent(DataTableLinks, {
						id: row.original.roleId,
						name: row.original.roleName ?? '',
						entity: 'role'
					})
				: 'None'
	},
	{
		accessorKey: 'customPermissions',
		header: 'Permissions',
		cell: ({ row }) =>
			row.original.customPermissions
				? `Their own (${row.original.customPermissions})`
				: "The role's"
	},
	{
		accessorKey: 'isActive',
		header: 'Status',
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: row.original.isActive ? 'active' : 'inactive',
				label: row.original.isActive ? 'Active' : 'Switched off'
			})
	},
	{
		accessorKey: 'createdAt',
		header: 'Added',
		cell: ({ row }) => ethiopianDate(row.original.createdAt)
	}
];
