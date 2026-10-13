import { decorPackages, homePortfolio } from '$lib/server/services/home';
import { quoteFormOptions } from '$lib/server/services/quotes';
import { getSettings, publicContact } from '$lib/server/services/settings';

/**
 * Event décor (`/decor`): what the service is and includes, the kinds of event it dresses, every
 * package on sale and some recent work. Asking for a quote is its own page, `/decor/quote`.
 */
export const load = async () => {
	const [packages, portfolio, options, settings] = await Promise.all([
		decorPackages(),
		homePortfolio(),
		quoteFormOptions(),
		getSettings()
	]);
	return { packages, portfolio, events: options.events, contact: publicContact(settings) };
};
