import { error, type RequestEvent } from '@sveltejs/kit';
import { renterForUser, type RenterRow } from '$lib/server/services/renters';
import type { Actor } from '$lib/server/services/payments/payable';

/**
 * The signed-in renter on a `/renter` page or action (§5.12). The hook has already refused anyone
 * who is not a renter account; this finds their business, and every renter query is scoped to its
 * id, so one renter can never reach another's listings, orders or receipts.
 */
export async function currentRenter(locals: App.Locals): Promise<RenterRow> {
	if (!locals.user) error(401, 'Sign in first.');
	const row = await renterForUser(locals.user.id);
	if (!row) error(403, 'This account has no renter business.');
	return row;
}

/** The renter, for the audit trail. */
export const renterActor = (event: Pick<RequestEvent, 'locals' | 'getClientAddress'>): Actor => ({
	locals: { user: event.locals.user ? { id: event.locals.user.id } : null },
	getClientAddress: event.getClientAddress
});
