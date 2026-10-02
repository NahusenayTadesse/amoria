import { formatEthiopianDate } from '@nahu/admin-kit/global';
import type { STOCK_REASONS } from './constants';
import { dayNoon } from './stockMath';

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
	expiry: {
		label: 'Expired',
		direction: 'out',
		manual: true,
		hint: 'Past its date and written off'
	},
	adjustment: {
		label: 'Correction',
		direction: 'either',
		manual: true,
		hint: 'Fixes a miscount, up or down'
	},
	sale: { label: 'Sold online', direction: 'out', manual: false },
	sale_cancel: { label: 'Online sale cancelled', direction: 'in', manual: false },
	pos_sale: { label: 'Sold at the till', direction: 'out', manual: false },
	transfer_in: { label: 'Moved in', direction: 'in', manual: false },
	transfer_out: { label: 'Moved out', direction: 'out', manual: false },
	issue: { label: 'Issued for use', direction: 'out', manual: false },
	customer_return: { label: 'Returned by a customer', direction: 'in', manual: false },
	supplier_return: { label: 'Sent back to a supplier', direction: 'out', manual: false }
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
	order: (id) => `/dashboard/orders/${id}`,
	document: (id) => `/dashboard/stock/documents/${id}`
};

/** Staff wording for product kinds. */
export const PRODUCT_KIND_LABELS: Record<string, string> = {
	gift: 'Gift',
	rental: 'Rental equipment',
	material: 'Material'
};

/* ------------------------------ Documents, orders, counts and the till ------------------------------ */

export const DOCUMENT_LABELS = {
	receipt: 'Goods receipt',
	issue: 'Issue',
	transfer: 'Transfer',
	adjustment: 'Adjustment',
	sales_return: 'Customer return',
	purchase_return: 'Return to supplier'
} as const;

/** What each kind of document is for, under its "New" button. */
export const DOCUMENT_HINTS = {
	receipt: 'Goods that arrived from a supplier',
	issue: 'Stock taken for use: décor jobs, the school, the shop',
	transfer: 'Moving stock between locations, or into quarantine',
	adjustment: 'Damage, loss, expiry, found stock or opening stock'
} as const;

export const ADJUSTMENT_REASON_LABELS = {
	count: 'Stock count',
	damage: 'Damaged',
	expiry: 'Expired',
	found: 'Found',
	opening: 'Opening stock',
	other: 'Other'
} as const;

export const LOCATION_KIND_LABELS = {
	shop: 'Shop floor',
	storage: 'Storage',
	workshop: 'Workshop',
	quarantine: 'Quarantine'
} as const;

export const REQUISITION_PURPOSE_LABELS = {
	decor: 'Décor job',
	school: 'School',
	shop: 'Shop',
	rental: 'Rentals',
	other: 'Other'
} as const;

export const POS_METHOD_LABELS = {
	cash: 'Cash',
	telebirr: 'Telebirr',
	cbe_birr: 'CBE Birr',
	bank_transfer: 'Bank transfer',
	card: 'Card'
} as const;

/**
 * How a status shows in the kit's badge: `status` picks the colour from the kit's own map (it does
 * not know `posted` or `ordered`, so each is given the colour of a state it does know), `label` is
 * the words.
 */
const BADGES: Record<string, { status: string; label: string }> = {
	draft: { status: 'draft', label: 'Draft' },
	posted: { status: 'completed', label: 'Posted' },
	cancelled: { status: 'cancelled', label: 'Cancelled' },
	ordered: { status: 'sent', label: 'Ordered' },
	partially_received: { status: 'pending', label: 'Part received' },
	received: { status: 'completed', label: 'Received' },
	closed: { status: 'closed', label: 'Closed' },
	open: { status: 'open', label: 'Open' },
	submitted: { status: 'sent', label: 'Waiting for approval' },
	approved: { status: 'approved', label: 'Approved' },
	rejected: { status: 'rejected', label: 'Rejected' },
	issued: { status: 'completed', label: 'Issued' }
};

export function badge(status: string): { status: string; label: string } {
	return BADGES[status] ?? { status, label: status.replaceAll('_', ' ') };
}

/** `20 units` / `1 unit`, for what the ledger and the pages count in. */
export const units = (n: number, unit = 'pcs') => `${n} ${unit}`;

/** A business day (`YYYY-MM-DD`) on the Ethiopian calendar, for tables and sentences. */
export const ethDay = (day: string | null | undefined) =>
	day ? formatEthiopianDate(dayNoon(day)) : '—';

/** The stock reports, by their address (`/dashboard/reports/<name>`). */
export const REPORTS = {
	value: 'What the stock is worth',
	movement: 'Stock in and out',
	usage: 'What is used most',
	'write-offs': 'Damaged, lost and expired',
	buying: 'Suppliers and deliveries',
	sales: 'Sales',
	slow: 'Slow-moving stock',
	abc: 'ABC analysis',
	'stock-outs': 'Stock-outs',
	trend: 'One product over time',
	vat: 'VAT'
} as const;
export type ReportName = keyof typeof REPORTS;
