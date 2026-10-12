import { error } from '@sveltejs/kit';
import { listingBySlug } from '$lib/server/services/marketplace';
import { renterAccounts } from '$lib/server/services/renters';
import { marketForms, marketOrder } from '$lib/server/marketForms';

/**
 * One rental (`/rentals/[slug]`, §5.12): its photos, video, details and renter, with "Book now"
 * when it has a set price (and the renter has an account to pay into) and "Ask for a quote".
 */
export const load = async ({ params }) => {
	const found = await listingBySlug(params.slug);
	if (!found) error(404, 'Rental not found');
	const canBook =
		found.listing.pricing === 'fixed' &&
		found.listing.price != null &&
		(await renterAccounts(found.renter.id)).length > 0;
	return { ...found, canBook, ...(await marketForms()) };
};

export const actions = {
	book: (event) => marketOrder(event, 'book', { listingSlug: event.params.slug }),
	ask: (event) => marketOrder(event, 'ask', { listingSlug: event.params.slug })
};
