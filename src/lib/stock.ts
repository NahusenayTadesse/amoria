import type { STOCK_REASONS } from './constants';

/**
 * What each stock movement reason means, in one table — for every kind of product the site
 * stocks (gifts, rental equipment, and whatever comes next: décor materials, school kits).
 *
 * **Extending it.** A new reason is one entry here plus its value in `STOCK_REASONS`
 * (`$lib/constants`, then a migration for the enum). A new *source* of movements — rentals going
 * out and back, décor jobs using materials — calls `stock.move()` with its own `refType` and adds
 * one line to `STOCK_REF_LINKS`, so the ledger links to it. No screen needs to change.
 */

export type StockReason = (typeof STOCK_REASONS)[number];

export type ReasonMeta = {
	label: string;
	/** `in` adds, `out` removes, `either` is a signed correction. */
	direction: 'in' | 'out' | 'either';
	/** Staff may record it by hand; otherwise only the system writes it (sales, cancellations). */
	manual: boolean;
	/** Shown under the choice on the adjust form. */
	hint?: string;
};

export const STOCK_REASON_META: Record<StockReason, ReasonMeta> = {
	delivery: {
		label: 'Delivery received',
		direction: 'in',
		manual: true,
		hint: 'New stock from a supplier or the workshop'
	},
	opening: {
		label: 'Opening stock',
		direction: 'in',
		manual: true,
		hint: 'What was on the shelf when the system started'
	},
	damage: {
		label: 'Damaged',
		direction: 'out',
		manual: true,
		hint: 'Broken, stained or otherwise unsellable'
	},
	loss: { label: 'Lost or missing', direction: 'out', manual: true },
	adjustment: {
		label: 'Correction',
		direction: 'either',
		manual: true,
		hint: 'Fixes a miscount, up or down'
	},
	sale: { label: 'Sold', direction: 'out', manual: false },
	sale_cancel: { label: 'Sale cancelled', direction: 'in', manual: false }
};

/** The reasons offered on the adjust form, in display order. */
export const MANUAL_REASONS = (Object.keys(STOCK_REASON_META) as StockReason[]).filter(
	(reason) => STOCK_REASON_META[reason].manual
);

/**
 * Where a movement's `refType` points in the dashboard, so the ledger can link to what caused it.
 * One line per source; a source missing here simply shows without a link.
 */
export const STOCK_REF_LINKS: Record<string, (id: number) => string> = {
	order: (id) => `/dashboard/orders/${id}`
};

/** Staff wording for product kinds. */
export const PRODUCT_KIND_LABELS: Record<string, string> = {
	gift: 'Gift',
	rental: 'Rental equipment'
};
