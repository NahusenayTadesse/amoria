import { m } from '$lib/paraglide/messages.js';
import { birr } from '$lib/localized';
import type { PriceUnit, RenterOrderStatus } from '$lib/rentalMarket';

/**
 * The marketplace's storefront wording (§5.12), in the visitor's language. The dashboards use the
 * English labels in `$lib/rentalMarket`.
 */

export function unitText(unit: PriceUnit): string {
	return {
		day: m.market_unit_day,
		event: m.market_unit_event,
		hour: m.market_unit_hour,
		item: m.market_unit_item
	}[unit]();
}

/** "ETB 500.00 / day", "From ETB 8,000.00", or "Price on request". */
export function priceText(listing: {
	pricing: 'fixed' | 'quote';
	price: number | null;
	priceUnit: PriceUnit;
}): { amount: string; unit: string | null } {
	if (listing.pricing === 'fixed' && listing.price != null) {
		return { amount: birr(listing.price), unit: unitText(listing.priceUnit) };
	}
	if (listing.price)
		return { amount: m.market_price_from({ price: birr(listing.price) }), unit: null };
	return { amount: m.market_price_ask(), unit: null };
}

export function orderStatusText(status: RenterOrderStatus): string {
	return {
		quote_requested: m.rb_status_quote_requested,
		quoted: m.rb_status_quoted,
		pending_payment: m.rb_status_pending_payment,
		payment_review: m.rb_status_payment_review,
		confirmed: m.rb_status_confirmed,
		out: m.rb_status_out,
		completed: m.rb_status_completed,
		declined: m.rb_status_declined,
		cancelled: m.rb_status_cancelled,
		expired: m.rb_status_expired
	}[status]();
}

/** Years since a renter started, for "12 years in business"; null when not given or this year. */
export function yearsIn(foundedYear: number | null): number | null {
	if (!foundedYear) return null;
	const years = new Date().getFullYear() - foundedYear;
	return years >= 1 ? years : null;
}
