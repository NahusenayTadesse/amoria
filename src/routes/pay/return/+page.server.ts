import { error, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';
import { verify } from '$lib/server/services/payments';

/**
 * Where Chapa sends the customer back (§7). Arriving proves nothing — it only prompts a check with
 * Chapa — and then the customer lands on the record's status page, which says what happened.
 */
export const load = async ({ url }) => {
	const txRef = url.searchParams.get('tx_ref') ?? url.searchParams.get('trx_ref');
	if (!txRef) error(404, 'Payment not found');

	const outcome = await verify(txRef);
	if (!outcome.statusPath) error(404, 'This payment link is not valid.');

	redirect(303, localizeHref(`${outcome.statusPath}?payment=${outcome.status}`));
};
