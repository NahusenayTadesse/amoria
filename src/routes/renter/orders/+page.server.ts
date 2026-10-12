import { currentRenter } from '$lib/server/renterArea';
import { renterOrderTable } from '$lib/server/renterOrderList';

/** Every booking and request the renter has had, filterable by status. */
export const load = async ({ locals, url }) => {
	const renter = await currentRenter(locals);
	return renterOrderTable(url, { renterId: renter.id });
};
