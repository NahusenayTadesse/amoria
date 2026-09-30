/**
 * The delivery fee rule, in one place (fixtec's `resolveDeliveryFee`, split so both sides share
 * it). The checkout sheet shows the fee with this; `services/delivery.ts` charges it with this,
 * using the area's fee and the threshold as read from the database. The two cannot disagree.
 *
 * No server imports: the browser runs it for the running total.
 */

export type FreeDelivery = {
	/** Orders at or above this pay no delivery. 0 turns free delivery off. */
	threshold: number;
	/** Above this, the bag starts saying how far the customer is from free delivery. */
	suggestAt: number;
};

/** Free delivery is on, and this subtotal reaches it. */
export function qualifiesForFreeDelivery(subtotal: number, free: FreeDelivery): boolean {
	// A threshold of 0 means "off", not "everything is free" — fixtec learned that the hard way.
	return free.threshold > 0 && subtotal >= free.threshold;
}

/** What delivery to an area costs for this subtotal. */
export function deliveryFee(areaFee: number, subtotal: number, free: FreeDelivery): number {
	return qualifiesForFreeDelivery(subtotal, free) ? 0 : areaFee;
}

/**
 * How much more would make delivery free, or `null` when there is nothing to say: free delivery
 * is off, the bag is below `suggestAt` (too far away to be worth mentioning), or it already
 * qualifies.
 */
export function awayFromFreeDelivery(subtotal: number, free: FreeDelivery): number | null {
	if (free.threshold <= 0 || subtotal < free.suggestAt || subtotal >= free.threshold) return null;
	return Math.round((free.threshold - subtotal) * 100) / 100;
}
