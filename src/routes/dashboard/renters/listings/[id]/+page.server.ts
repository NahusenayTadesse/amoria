import { error, type RequestEvent } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import { category, renter, renterListing, renterListingImage, user } from '$lib/server/db/schema';
import { reviewListing } from '$lib/server/services/renters';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt, formAttempt } from '$lib/server/attempt';
import { reviewNoteSchema } from '$lib/schemas/renters';

/** One renter listing as customers would see it, to approve, send back, or take down. */
function listingId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Listing not found');
	return id;
}

export const load = async ({ params }) => {
	const id = listingId(params);
	const [row] = await db
		.select({
			listing: renterListing,
			categoryName: category.name,
			renterId: renter.id,
			renterName: renter.businessName,
			renterStatus: renter.status,
			autoPublish: renter.autoPublish
		})
		.from(renterListing)
		.innerJoin(renter, eq(renter.id, renterListing.renterId))
		.innerJoin(category, eq(category.id, renterListing.categoryId))
		.where(and(eq(renterListing.id, id), notDeleted(renterListing)));
	if (!row) error(404, 'Listing not found');

	const [photos, reviewer] = await Promise.all([
		db
			.select({
				id: renterListingImage.id,
				fileName: renterListingImage.fileName,
				alt: renterListingImage.alt
			})
			.from(renterListingImage)
			.where(and(eq(renterListingImage.listingId, id), notDeleted(renterListingImage)))
			.orderBy(asc(renterListingImage.sortOrder), asc(renterListingImage.id)),
		row.listing.reviewedBy
			? db.select({ name: user.name }).from(user).where(eq(user.id, row.listing.reviewedBy))
			: []
	]);

	return {
		...row,
		photos,
		reviewerName: reviewer[0]?.name ?? null,
		noteForm: await superValidate(zod4(reviewNoteSchema))
	};
};

export const actions = {
	approve: async (event) => {
		requirePermission(event.locals, 'renters.manage');
		return attempt(
			() => reviewListing(actorOf(event), listingId(event.params), 'approve', null),
			'Approved: it is live on the marketplace.'
		);
	},
	reject: async (event: RequestEvent<{ id: string }>) => {
		requirePermission(event.locals, 'renters.manage');
		const form = await superValidate(event.request, zod4(reviewNoteSchema));
		return formAttempt(
			form,
			() => reviewListing(actorOf(event), listingId(event.params), 'reject', form.data.note),
			'Sent back to the renter with your note.'
		);
	}
};
