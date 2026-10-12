import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { renterListing, renterListingImage } from '$lib/server/db/schema';
import { currentRenter, renterActor } from '$lib/server/renterArea';
import { photoGallery } from '$lib/server/photoGallery';
import {
	deleteListing,
	photosChanged,
	rentalCategories,
	setListingPaused,
	updateListing
} from '$lib/server/services/renters';
import { attempt } from '$lib/server/attempt';
import { LISTING_STATUS_LABELS } from '$lib/rentalMarket';
import { listingSchema } from '$lib/schemas/renters';

/**
 * One of the renter's rentals: its details, its photos, and putting it on or off the site. Every
 * read and write is matched to the signed-in renter; a listing of someone else's is a 404.
 */

function listingId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Rental not found');
	return id;
}

async function own(locals: App.Locals, params: { id?: string }) {
	const renter = await currentRenter(locals);
	const id = listingId(params);
	const [row] = await db
		.select()
		.from(renterListing)
		.where(
			and(
				eq(renterListing.id, id),
				eq(renterListing.renterId, renter.id),
				notDeleted(renterListing)
			)
		);
	if (!row) error(404, 'Rental not found');
	return { renter, listing: row };
}

/** The photos: renters add, replace, reorder and remove their own; a new photo means a new review. */
const photosFor = (renterId: number) =>
	photoGallery({
		table: renterListingImage,
		ownerColumn: 'listingId',
		permission: null,
		audit: 'renter_listing_image',
		canRemove: () => {},
		onChanged: (id) => photosChanged(renterId, id)
	});

const asLines = (value: unknown) => (Array.isArray(value) ? value.join('\n') : '');

export const load = async ({ locals, params }) => {
	const { renter, listing } = await own(locals, params);
	const [form, categories, photos] = await Promise.all([
		superValidate(
			{
				categoryId: listing.categoryId,
				name: listing.name,
				nameAm: listing.nameAm ?? '',
				summary: listing.summary ?? '',
				summaryAm: listing.summaryAm ?? '',
				description: listing.description ?? '',
				descriptionAm: listing.descriptionAm ?? '',
				features: asLines(listing.features),
				featuresAm: asLines(listing.featuresAm),
				pricing: listing.pricing,
				price: listing.price ?? undefined,
				priceUnit: listing.priceUnit,
				deposit: listing.deposit,
				quantity: listing.quantity,
				capacity: listing.capacity ?? undefined,
				youtubeUrl: listing.youtubeUrl ?? '',
				deliveryAvailable: listing.deliveryAvailable,
				setupIncluded: listing.setupIncluded
			},
			zod4(listingSchema),
			{ errors: false }
		),
		rentalCategories(),
		photosFor(renter.id).load(listing.id)
	]);
	return {
		listing: {
			id: listing.id,
			slug: listing.slug,
			name: listing.name,
			status: listing.status,
			statusLabel: LISTING_STATUS_LABELS[listing.status],
			reviewNote: listing.reviewNote
		},
		form,
		categories,
		photos
	};
};

export const actions = {
	save: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		const form = await superValidate(event.request, zod4(listingSchema));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);
		}
		try {
			const { status } = await updateListing(renterActor(event), renter.id, listing.id, form.data);
			return message(form, {
				type: 'success',
				text:
					status === 'pending_review'
						? 'Saved. Amoria checks the change before it shows on the site.'
						: 'Saved.'
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) return setError(form, err.field as '', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
	},

	pause: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		return attempt(
			() => setListingPaused(renterActor(event), renter.id, listing.id, true),
			'Paused: it is off the site until you put it back.'
		);
	},

	resume: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		return attempt(
			() => setListingPaused(renterActor(event), renter.id, listing.id, false),
			'Back on the site.'
		);
	},

	remove: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		const result = await attempt(
			() => deleteListing(renterActor(event), renter.id, listing.id),
			'Removed.'
		);
		if ('done' in result) redirect(303, '/renter/listings');
		return result;
	},

	addPhotos: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		return photosFor(renter.id).actions.addPhotos(event, listing.id);
	},
	editPhoto: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		return photosFor(renter.id).actions.editPhoto(event, listing.id);
	},
	deletePhoto: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		return photosFor(renter.id).actions.deletePhoto(event, listing.id);
	},
	movePhoto: async (event) => {
		const { renter, listing } = await own(event.locals, event.params);
		return photosFor(renter.id).actions.movePhoto(event, listing.id);
	}
};
