import { and, count, inArray } from 'drizzle-orm';
import { contentCrud } from '@nahu/admin-kit/server/crud';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { rentalSpace, rentalSpaceImage } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { spaceAdd, spaceEdit } from '$lib/schemas/spaces';
import { slugify } from '$lib/slug';

/**
 * The spaces Amoria rents out for events: the kit's `contentCrud`. The storefront link is made
 * from the name when left empty, and empty optional text is stored as null so the pages can tell
 * "not filled in" from a blank. Photos and the video preview are on each space's own page.
 */
const crud = contentCrud({
	table: rentalSpace,
	label: 'Space',
	addSchema: spaceAdd,
	editSchema: spaceEdit,
	uniqueField: 'slug',
	audit: 'rental_space',
	listFields: ['features', 'featuresAm'],
	transform: async (values) => {
		const row = { ...values };
		row.slug = row.slug || slugify(row.name);
		if (!row.slug)
			throw new WriteRefused('slug', 'Give it a link name in Latin letters, e.g. garden-hall');
		for (const key of [
			'nameAm',
			'summary',
			'summaryAm',
			'description',
			'descriptionAm',
			'sizeText',
			'priceUnit',
			'priceUnitAm',
			'youtubeUrl'
		] as const) {
			row[key] = row[key] || null;
		}
		row.capacity = row.capacity ?? null;
		row.price = row.price ?? null;
		return row;
	}
});

export const load = async () => {
	const page = await crud.load();
	const ids = (page.rows as { id: number }[]).map((row) => row.id);

	const photos = ids.length
		? await db
				.select({ spaceId: rentalSpaceImage.spaceId, n: count() })
				.from(rentalSpaceImage)
				.where(and(inArray(rentalSpaceImage.spaceId, ids), notDeleted(rentalSpaceImage)))
				.groupBy(rentalSpaceImage.spaceId)
		: [];
	const photoCount = new Map(photos.map((row) => [row.spaceId, Number(row.n)]));

	return {
		...page,
		rows: (page.rows as (typeof rentalSpace.$inferSelect & { status: boolean })[]).map((row) => ({
			...row,
			// The edit dialog's boxes take one item per line.
			features: asLines(row.features),
			featuresAm: asLines(row.featuresAm),
			photos: photoCount.get(row.id) ?? 0
		}))
	};
};

function asLines(value: unknown): string {
	return Array.isArray(value) ? value.join('\n') : '';
}

export const actions = invalidating(['catalog'], crud.actions);
