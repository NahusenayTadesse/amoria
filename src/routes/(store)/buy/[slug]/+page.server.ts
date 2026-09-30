import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';

/**
 * The direct-buy link for ads and chats (§10, §11): `/buy/red-rose-box` puts that gift in the
 * bag and opens checkout on the shop page. The shop does the adding, so an unknown or sold-out
 * slug simply lands on the shop.
 */
export const load = ({ params }) => {
	redirect(303, localizeHref(`/shop?add=${encodeURIComponent(params.slug)}`));
};
