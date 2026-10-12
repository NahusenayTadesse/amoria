import { error } from '@sveltejs/kit';
import { rentalSpaceBySlug } from '$lib/server/services/spaces';
import { getSettings, publicContact } from '$lib/server/services/settings';

/** One space (`/spaces/[slug]`): its write-up, features, video and gallery. */
export const load = async ({ params }) => {
	const [space, settings] = await Promise.all([rentalSpaceBySlug(params.slug), getSettings()]);
	if (!space) error(404, 'Space not found');
	return { space, contact: publicContact(settings) };
};
