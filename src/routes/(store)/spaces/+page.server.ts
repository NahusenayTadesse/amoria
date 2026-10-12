import { rentalSpaces } from '$lib/server/services/spaces';
import { getSettings, publicContact } from '$lib/server/services/settings';

/** The rental spaces (`/spaces`): every space on offer, each with its cover photo. */
export const load = async () => {
	const [spaces, settings] = await Promise.all([rentalSpaces(), getSettings()]);
	return { spaces, contact: publicContact(settings) };
};
