import { fail, type RequestEvent } from '@sveltejs/kit';
import { and, asc, eq, max, type SQL } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { childCrud } from '@nahu/admin-kit/server/childCrud';
import { saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { requirePermission, requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '$lib/server/db';
import {
	bundleImage,
	productImage,
	rentalSpaceImage,
	renterListingImage
} from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import { photoEdit, photosAdd } from '$lib/schemas/photos';

/**
 * A record's photo gallery for the dashboard, over one of the image child tables (§5.2): the
 * first photo by `sortOrder` is the main one (the card and the top of the page), the rest follow.
 *
 * The kit's `childCrud` does the owner-scoped edit (a new file replaces the stored one; none keeps
 * it) and delete. Added here: several photos at once, and moving a photo, which `childCrud` has
 * no shape for. Every write drops the catalog cache and the public-image list, since what guests
 * see and which files `/media` may serve both change.
 *
 * The page's actions keep these names, so `PhotoManager.svelte` can post to them:
 * `addPhotos`, `editPhoto`, `deletePhoto`, `movePhoto`.
 */

type PhotoTable =
	typeof productImage | typeof bundleImage | typeof rentalSpaceImage | typeof renterListingImage;
export type PhotoRow = {
	id: number;
	fileName: string;
	alt: string | null;
	altAm: string | null;
	sortOrder: number;
};

export function photoGallery(options: {
	table: PhotoTable;
	ownerColumn: 'productId' | 'bundleId' | 'spaceId' | 'listingId';
	/**
	 * What a write needs beyond the route's gate. Removing a photo needs a super admin (§2.2).
	 * Null for a renter's own listing (§5.12): renters hold no staff permissions, and the
	 * `/renter` gate plus the route's ownership check are what decide.
	 */
	permission: string | null;
	/** The table's audit name. */
	audit: string;
	/** Who may remove a photo; the default is a super admin. */
	canRemove?: (event: RequestEvent) => void;
	/** After a photo is added or replaced: a renter's listing goes back for review. */
	onChanged?: (ownerId: number) => Promise<void>;
}) {
	const { table, ownerColumn, permission, audit, onChanged } = options;
	const check = (event: RequestEvent) => {
		if (permission) requirePermission(event.locals, permission);
	};
	const canRemove = options.canRemove ?? ((event: RequestEvent) => requireSuperAdmin(event.locals));
	const owner = (table as unknown as Record<string, MySqlColumn>)[ownerColumn];
	const ownedBy = (ownerId: number): SQL => and(eq(owner, ownerId), notDeleted(table)) as SQL;

	const crud = childCrud({
		table,
		ownerColumn,
		label: 'Photo',
		// Unused: photos are added several at a time by `addPhotos`.
		addSchema: photoEdit.omit({ id: true }),
		editSchema: photoEdit,
		fileFields: ['fileName'],
		...(permission ? { permission } : {}),
		audit,
		transform: (values) => ({ ...values, alt: values.alt || null, altAm: values.altAm || null })
	});

	const refresh = () => {
		invalidate('catalog');
		invalidate('public-images');
	};

	/** The ids in gallery order, locked, renumbered 0, 1, 2… after `reorder` has moved them. */
	async function reorder(ownerId: number, change: (ids: number[]) => number[] | null) {
		await db.transaction(async (tx) => {
			const rows = await tx
				.select({ id: table.id })
				.from(table)
				.where(ownedBy(ownerId))
				.orderBy(asc(table.sortOrder), asc(table.id))
				.for('update');
			const next = change(rows.map((row) => row.id));
			if (!next) return;
			for (const [index, id] of next.entries()) {
				await tx.update(table).set({ sortOrder: index }).where(eq(table.id, id));
			}
		});
	}

	return {
		/** The photos in gallery order, and the two forms `PhotoManager` needs. */
		load: async (ownerId: number) => {
			const page = await crud.load(ownerId);
			return {
				// childCrud lists by id; the site shows them by `sortOrder`, so the dashboard does too.
				rows: (page.rows as unknown as PhotoRow[]).toSorted(
					(a, b) => a.sortOrder - b.sortOrder || a.id - b.id
				),
				addForm: await superValidate(zod4(photosAdd)),
				editForm: page.editForm
			};
		},

		actions: {
			/** Several photos at once, each a row, after the ones already there. */
			addPhotos: async (event: RequestEvent, ownerId: number) => {
				check(event);
				const form = await superValidate(event.request, zod4(photosAdd));
				// Files cannot travel back in the answer; the picker is emptied either way.
				const files = form.data.images;
				form.data.images = [];
				if (!form.valid) return fail(400, { form });

				const saved: string[] = [];
				try {
					for (const file of files) saved.push(await saveUploadedFile(file));
				} catch (err) {
					if (err instanceof UploadRefused) {
						return message(form, { type: 'error', text: err.message }, { status: 400 });
					}
					throw err;
				}

				await db.transaction(async (tx) => {
					const [{ last }] = await tx
						.select({ last: max(table.sortOrder) })
						.from(table)
						.where(ownedBy(ownerId));
					let order = (last ?? -1) + 1;
					await tx.insert(table).values(
						saved.map((fileName) => ({
							[ownerColumn]: ownerId,
							fileName,
							sortOrder: order++
						})) as unknown as (typeof table.$inferInsert)[]
					);
					await recordAudit(tx, event, {
						table: audit,
						recordId: ownerId,
						action: 'create',
						detail: { added: saved }
					});
				});
				await onChanged?.(ownerId);
				refresh();
				return message(form, {
					type: 'success',
					text: saved.length === 1 ? 'Photo added.' : `${saved.length} photos added.`
				});
			},

			/** A new file and/or caption for one photo. */
			editPhoto: async (event: RequestEvent, ownerId: number) => {
				const result = await crud.actions.edit(event, ownerId);
				await onChanged?.(ownerId);
				refresh();
				return result;
			},

			deletePhoto: async (event: RequestEvent, ownerId: number) => {
				canRemove(event);
				const result = await crud.actions.delete(event, ownerId);
				refresh();
				return result;
			},

			/** One place earlier (`up`) or later (`down`), or to the front as the main photo (`first`). */
			movePhoto: async (event: RequestEvent, ownerId: number) => {
				check(event);
				const posted = await event.request.formData();
				const photoId = Number(posted.get('id'));
				const direction = String(posted.get('direction'));

				await reorder(ownerId, (ids) => {
					const from = ids.indexOf(photoId);
					if (from === -1) return null;
					const to = direction === 'first' ? 0 : from + (direction === 'up' ? -1 : 1);
					if (to < 0 || to >= ids.length || to === from) return null;
					const next = [...ids];
					next.splice(to, 0, ...next.splice(from, 1));
					return next;
				});
				refresh();
				return { moved: true };
			}
		}
	};
}
