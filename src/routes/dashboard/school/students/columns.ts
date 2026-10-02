import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { ethiopianDate, ethiopianDateTime } from '@nahu/admin-kit/tableCells';
import { formatETB } from '@nahu/admin-kit/global';
import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '$lib/registrationStatus';

export type StudentRow = {
	id: number;
	ref: string | null;
	createdAt: Date;
	contactName: string;
	contactPhone: string;
	fee: number;
	status: RegistrationStatus;
	courseTitle: string;
	startDate: string;
	shiftName: string | null;
	result: 'pending' | 'graduated' | 'not_graduated';
	certificateNo: string | null;
	receiptWaiting: boolean;
};

export const columns: ColumnDef<StudentRow>[] = [
	{
		accessorKey: 'ref',
		header: 'Registration',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.ref ?? `#${row.original.id}`,
				entity: 'registration'
			})
	},
	{
		accessorKey: 'createdAt',
		header: 'Registered',
		cell: ({ row }) => ethiopianDateTime(row.original.createdAt)
	},
	{
		accessorKey: 'contactName',
		header: 'Student',
		cell: ({ row }) => `${row.original.contactName}, ${row.original.contactPhone}`
	},
	{
		accessorKey: 'courseTitle',
		header: 'Course',
		cell: ({ row }) =>
			`${row.original.courseTitle}, from ${ethiopianDate(new Date(`${row.original.startDate}T12:00:00+03:00`))}${row.original.shiftName ? `, ${row.original.shiftName}` : ''}`
	},
	{
		accessorKey: 'result',
		header: 'Result',
		cell: ({ row }) =>
			row.original.result === 'graduated'
				? `Graduated, ${row.original.certificateNo ?? ''}`
				: row.original.result === 'not_graduated'
					? 'Did not graduate'
					: ''
	},
	{ accessorKey: 'fee', header: 'Fee', cell: ({ row }) => formatETB(row.original.fee) },
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) =>
			row.original.receiptWaiting
				? renderComponent(Statuses, { status: 'initiated', label: 'Receipt to check' })
				: renderComponent(Statuses, {
						status: row.original.status,
						label: REGISTRATION_STATUS_LABELS[row.original.status]
					})
	}
];
