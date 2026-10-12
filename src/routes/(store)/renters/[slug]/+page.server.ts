import { error } from '@sveltejs/kit';
import { renterBySlug } from '$lib/server/services/marketplace';
import { marketForms, marketOrder } from '$lib/server/marketForms';

/** A renter's page (`/renters/[slug]`, §5.12): who they are, what they rent, and a custom request. */
export const load = async ({ params }) => {
	const found = await renterBySlug(params.slug);
	if (!found) error(404, 'Renter not found');
	const { askForm } = await marketForms();
	return { ...found, askForm };
};

export const actions = {
	ask: (event) => marketOrder(event, 'ask', { renterSlug: event.params.slug })
};
