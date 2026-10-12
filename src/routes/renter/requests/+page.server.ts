import { currentRenter } from '$lib/server/renterArea';
import { renterOrderTable } from '$lib/server/renterOrderList';

/** Quote requests waiting for a price, and quotes waiting for the customer. */
export const load = async ({ locals, url }) => {
	const renter = await currentRenter(locals);
	return renterOrderTable(url, { renterId: renter.id, only: ['quote_requested', 'quoted'] });
};
