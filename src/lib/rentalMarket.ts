import type {
	LISTING_STATUSES,
	PRICE_UNITS,
	RENTER_ORDER_STATUSES,
	RENTER_STATUSES
} from './constants';
import { lineTotal, sumBirr } from './money';

/**
 * The rental marketplace's shared rules (§5.12): prices, the order life cycle and the dashboard
 * wording. No server imports: the listing page previews a total with the same function the
 * service stores, though the server always recomputes it.
 */

export type PriceUnit = (typeof PRICE_UNITS)[number];
export type RenterStatus = (typeof RENTER_STATUSES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type RenterOrderStatus = (typeof RENTER_ORDER_STATUSES)[number];

/** The most of one listing one order may take, and the longest booking, in days. */
export const MAX_ORDER_QTY = 1000;
export const MAX_RENTAL_DAYS = 60;
export const MAX_HOURS = 24;

/** Days from `start` to `end`, both counted (`YYYY-MM-DD`). 0 if `end` is before `start`. */
export function rentalDays(start: string, end: string): number {
	const from = Date.parse(`${start}T00:00:00Z`);
	const to = Date.parse(`${end}T00:00:00Z`);
	if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
	return Math.round((to - from) / 86_400_000) + 1;
}

/**
 * What a fixed-price booking costs: the price per unit × how many units (days for `day`, hours for
 * `hour`, once for `event` and `item`) × the quantity, plus the listing's deposit per item.
 */
export function fixedPrice(input: {
	price: number;
	unit: PriceUnit;
	deposit: number;
	qty: number;
	days: number;
	hours?: number | null;
}) {
	const units =
		input.unit === 'day' ? input.days : input.unit === 'hour' ? Math.max(1, input.hours ?? 1) : 1;
	const subtotal = lineTotal(input.price, units * input.qty);
	const deposit = lineTotal(input.deposit, input.qty);
	return { units, subtotal, deposit, total: sumBirr([subtotal, deposit]) };
}

/** Orders that hold the listing's units over their days: nobody else can book them meanwhile. */
export const HOLDS_UNITS: RenterOrderStatus[] = ['payment_review', 'confirmed', 'out'];

/** Still with the renter or the customer to act on: shown under "needs action". */
export const OPEN_ORDER: RenterOrderStatus[] = [
	'quote_requested',
	'quoted',
	'pending_payment',
	'payment_review',
	'confirmed',
	'out'
];

/** Money has been confirmed for these. */
export const PAID_ORDER: RenterOrderStatus[] = ['confirmed', 'out', 'completed'];

/**
 * What the renter can do with an order next, by hand. Getting paid is not here: it happens only by
 * accepting a receipt. `expired` is set only by the job.
 */
export const RENTER_ORDER_MOVES: Record<RenterOrderStatus, RenterOrderStatus[]> = {
	quote_requested: ['quoted', 'declined'],
	quoted: ['quoted', 'declined'],
	pending_payment: ['cancelled'],
	payment_review: ['cancelled'],
	confirmed: ['out', 'completed', 'cancelled'],
	out: ['completed'],
	completed: [],
	declined: [],
	cancelled: [],
	expired: []
};

/** Dashboard wording (staff and renters). The storefront has its own, translated. */
export const RENTER_ORDER_LABELS: Record<RenterOrderStatus, string> = {
	quote_requested: 'Wants a quote',
	quoted: 'Quote sent',
	pending_payment: 'Awaiting payment',
	payment_review: 'Receipt to check',
	confirmed: 'Paid, booked',
	out: 'With the customer',
	completed: 'Completed',
	declined: 'Declined',
	cancelled: 'Cancelled',
	expired: 'Expired'
};

/** The kit's badge knows its own statuses; each of ours borrows the colour of one it knows. */
export const RENTER_ORDER_BADGE: Record<RenterOrderStatus, string> = {
	quote_requested: 'new',
	quoted: 'sent',
	pending_payment: 'pending_payment',
	payment_review: 'pending',
	confirmed: 'confirmed',
	out: 'out',
	completed: 'completed',
	declined: 'declined',
	cancelled: 'cancelled',
	expired: 'expired'
};

export const RENTER_STATUS_LABELS: Record<RenterStatus, string> = {
	pending: 'Waiting for review',
	approved: 'Approved',
	rejected: 'Turned down',
	suspended: 'Suspended'
};

export const RENTER_STATUS_BADGE: Record<RenterStatus, string> = {
	pending: 'pending',
	approved: 'approved',
	rejected: 'rejected',
	suspended: 'inactive'
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
	draft: 'Draft',
	pending_review: 'In review',
	approved: 'Live',
	rejected: 'Changes needed',
	paused: 'Paused'
};

export const LISTING_STATUS_BADGE: Record<ListingStatus, string> = {
	draft: 'draft',
	pending_review: 'pending',
	approved: 'active',
	rejected: 'rejected',
	paused: 'inactive'
};

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
	day: 'per day',
	event: 'per event',
	hour: 'per hour',
	item: 'each'
};
