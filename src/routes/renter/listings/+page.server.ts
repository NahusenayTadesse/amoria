import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { category, renterListing, renterListingImage } from '$lib/server/db/schema';
import { currentRenter } from '$lib/server/renterArea';

/** The renter's rentals, each with where it stands and how many photos it has. */
export const load = async ({ locals }) => {
	const renter = await currentRenter(locals);
	const rows = await db
		.select({
			id: renterListing.id,
			slug: renterListing.slug,
			name: renterListing.name,
			categoryName: category.name,
			pricing: renterListing.pricing,
			price: renterListing.price,
			priceUnit: renterListing.priceUnit,
			quantity: renterListing.quantity,
			status: renterListing.status,
			reviewNote: renterListing.reviewNote,
			updatedAt: renterListing.updatedAt
		})
		.from(renterListing)
		.innerJoin(category, eq(category.id, renterListing.categoryId))
		.where(and(eq(renterListing.renterId, renter.id), notDeleted(renterListing)))
		.orderBy(desc(renterListing.updatedAt));

	const ids = rows.map((row) => row.id);
	const photos = ids.length
		? await db
				.select({ listingId: renterListingImage.listingId, n: count() })
				.from(renterListingImage)
				.where(and(inArray(renterListingImage.listingId, ids), notDeleted(renterListingImage)))
				.groupBy(renterListingImage.listingId)
		: [];
	return {
		rows: rows.map((row) => ({
			...row,
			photos: Number(photos.find((p) => p.listingId === row.id)?.n ?? 0)
		}))
	};
};
