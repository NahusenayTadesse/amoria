import { renterOrderTable } from '$lib/server/renterOrderList';

/**
 * Every marketplace order, for staff to oversee (disputes, a renter who does not answer). The
 * renter acts on their own orders; staff only look.
 */
export const load = async ({ url }) => renterOrderTable(url, {});
