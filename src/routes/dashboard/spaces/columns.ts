import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';

/** Photos and the video, linking to the space's page where they are managed. */
export const extraColumns: ColumnDef<LookupRow>[] = [
	{
		accessorKey: 'photos',
		header: 'Gallery',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: `${row.original.photos} photo${row.original.photos === 1 ? '' : 's'}${row.original.youtubeUrl ? ' + video' : ''}, manage`,
				entity: 'rental_space'
			})
	}
];
