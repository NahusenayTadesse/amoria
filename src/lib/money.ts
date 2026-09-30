/**
 * Birr arithmetic. Totals are summed in whole cents so repeated decimal addition cannot drift, and
 * every computed amount goes through `roundBirr` before it is stored (§5.0).
 *
 * No server imports: the storefront shows running totals with the same functions the services
 * store — though the server always recomputes, and never reads a total from the client.
 */

/** Two decimal places, the way `decimal(12,2)` stores it. */
export function roundBirr(amount: number): number {
	return Math.round(amount * 100) / 100;
}

/** `unitPrice × qty`, in birr. */
export function lineTotal(unitPrice: number, qty: number): number {
	return (Math.round(unitPrice * 100) * qty) / 100;
}

/** The sum of some amounts, added in cents. */
export function sumBirr(amounts: number[]): number {
	return amounts.reduce((cents, amount) => cents + Math.round(amount * 100), 0) / 100;
}
