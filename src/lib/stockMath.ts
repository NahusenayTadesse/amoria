/**
 * The arithmetic of stock, free of the database so it can be tested on its own and imported by the
 * dashboard too. Quantities are whole units; costs are birr per unit to four places.
 */
import { getEthiopianYearMonth } from '@nahu/admin-kit/global';
import type { DocumentType } from './constants';

/** A cost per unit, to the four places `decimal(12,4)` keeps. */
export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** A business day (`YYYY-MM-DD`) as an instant far from midnight in Addis Ababa, whatever the host zone. */
export const dayNoon = (day: string) => new Date(`${day}T12:00:00+03:00`);

/**
 * The moving weighted-average cost after `inQty` units arrive at `inCost`.
 *
 * With nothing on hand (or less, which a correct ledger never has) the old average describes no
 * stock, so the new one is simply the cost of what arrived.
 */
export function movingAverage(onHand: number, avgCost: number, inQty: number, inCost: number) {
	if (onHand <= 0) return round4(inCost);
	return round4((onHand * avgCost + inQty * inCost) / (onHand + inQty));
}

/** A lot expiring today is still in date; yesterday, it is not. Both are `YYYY-MM-DD`. */
export function isExpired(expiryDate: string | null | undefined, today: string): boolean {
	return Boolean(expiryDate) && expiryDate! < today;
}

export type Candidate = {
	/** Null for stock that carries no lot. */
	lotId: number | null;
	locationId: number;
	quantity: number;
	expiryDate: string | null;
	status: 'available' | 'quarantine' | 'recalled' | null;
};

export type Take = { locationId: number; lotId: number | null; quantity: number };

/**
 * Where an outgoing quantity comes from: first expiry first out, and within equal expiry the
 * candidates in the order given (the caller lists the shop floor first, so it empties before the
 * store room does).
 *
 * Lots with no expiry go last, so a dated box always leaves before an undated one. Expired,
 * quarantined and recalled lots are skipped unless `allowUnusable` (writing stock off or moving it
 * into quarantine, never selling it).
 *
 * Returns what it could take and how much it fell short. It never invents stock: a short result
 * means the shelf and the system already disagree, and the caller must say so rather than go
 * negative.
 */
export function allocate(
	candidates: Candidate[],
	quantity: number,
	options: {
		today: string;
		allowUnusable?: boolean;
		lotId?: number | null;
		/** `lotId: null` then means "the stock that has no lot", not "any lot" (a stock count's lines). */
		exactLot?: boolean;
	}
): { takes: Take[]; short: number } {
	const usable = candidates
		.map((candidate, order) => ({ candidate, order }))
		.filter(({ candidate: c }) => c.quantity > 0)
		.filter(({ candidate: c }) =>
			options.exactLot
				? c.lotId === (options.lotId ?? null)
				: options.lotId == null || c.lotId === options.lotId
		)
		.filter(
			({ candidate: c }) =>
				options.allowUnusable ||
				((c.status === null || c.status === 'available') && !isExpired(c.expiryDate, options.today))
		)
		.sort((a, b) => {
			const [x, y] = [a.candidate.expiryDate, b.candidate.expiryDate];
			if (x !== y) {
				if (x === null) return 1;
				if (y === null) return -1;
				return x < y ? -1 : 1;
			}
			return a.order - b.order;
		});

	let remaining = Math.round(quantity);
	const takes: Take[] = [];
	for (const { candidate } of usable) {
		if (remaining <= 0) break;
		const take = Math.min(candidate.quantity, remaining);
		takes.push({ locationId: candidate.locationId, lotId: candidate.lotId, quantity: take });
		remaining -= take;
	}
	return { takes, short: remaining };
}

/**
 * The Ethiopian fiscal year a calendar day falls in. It starts on Hamle 1 (month 11, early July),
 * so Hamle and Nehase belong to the *next* Ethiopian year's budget: Hamle 1, 2017 opens FY 2018.
 */
export function ethiopianFiscalYear(day: string): number {
	const parts = getEthiopianYearMonth(dayNoon(day));
	if (!parts) throw new Error(`Not a date: ${day}`);
	return parts.month >= 11 ? parts.year + 1 : parts.year;
}

/** What each kind of document is called on paper: the prefix of its number. */
export const DOCUMENT_PREFIX: Record<DocumentType | 'purchase_order' | 'requisition', string> = {
	receipt: 'GRN',
	issue: 'ISS',
	transfer: 'TRF',
	adjustment: 'ADJ',
	sales_return: 'SRN',
	purchase_return: 'PRN',
	purchase_order: 'PO',
	requisition: 'REQ'
};

/** `AM-GRN-2019-00042`: the shop, the kind, the fiscal year, a running number. */
export function documentNumber(
	kind: keyof typeof DOCUMENT_PREFIX,
	fiscalYear: number,
	n: number
): string {
	return `AM-${DOCUMENT_PREFIX[kind]}-${fiscalYear}-${String(n).padStart(5, '0')}`;
}

/** VAT inside a price that already includes it, in birr (before rounding). */
export function vatWithin(gross: number, ratePercent: number): number {
	return gross - gross / (1 + ratePercent / 100);
}
