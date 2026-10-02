import { describe, expect, it } from 'vitest';
import {
	allocate,
	documentNumber,
	ethiopianFiscalYear,
	isExpired,
	movingAverage,
	vatWithin,
	type Candidate
} from './stockMath';

const today = '2026-09-28';

const lot = (
	lotId: number | null,
	quantity: number,
	expiryDate: string | null,
	status: Candidate['status'] = 'available',
	locationId = 1
): Candidate => ({ lotId, locationId, quantity, expiryDate, status });

describe('allocate', () => {
	it('takes from the lot that expires first', () => {
		const result = allocate(
			[lot(1, 10, '2027-06-01'), lot(2, 10, '2026-12-01'), lot(3, 10, null)],
			15,
			{ today }
		);
		expect(result).toEqual({
			takes: [
				{ locationId: 1, lotId: 2, quantity: 10 },
				{ locationId: 1, lotId: 1, quantity: 5 }
			],
			short: 0
		});
	});

	it('leaves undated lots until last, and empties the earlier location first on a tie', () => {
		const shop = lot(null, 2, null, null, 1);
		const store = lot(null, 5, null, null, 2);
		const result = allocate([shop, store], 4, { today });
		expect(result.takes).toEqual([
			{ locationId: 1, lotId: null, quantity: 2 },
			{ locationId: 2, lotId: null, quantity: 2 }
		]);
	});

	it('never sells expired, quarantined or recalled lots', () => {
		const result = allocate(
			[
				lot(1, 5, '2026-09-27'),
				lot(2, 5, '2027-01-01', 'quarantine'),
				lot(3, 5, '2027-01-01', 'recalled'),
				lot(4, 5, '2027-01-01')
			],
			20,
			{ today }
		);
		expect(result).toEqual({ takes: [{ locationId: 1, lotId: 4, quantity: 5 }], short: 15 });
	});

	it('lets a write-off reach unusable lots', () => {
		const result = allocate([lot(1, 5, '2026-09-27')], 5, { today, allowUnusable: true });
		expect(result).toEqual({ takes: [{ locationId: 1, lotId: 1, quantity: 5 }], short: 0 });
	});

	it('takes only from the lot asked for', () => {
		const result = allocate([lot(1, 5, '2026-10-01'), lot(2, 5, '2027-01-01')], 3, {
			today,
			lotId: 2
		});
		expect(result.takes).toEqual([{ locationId: 1, lotId: 2, quantity: 3 }]);
	});

	it('reports a shortfall instead of inventing stock', () => {
		expect(allocate([lot(null, 2, null, null)], 5, { today })).toEqual({
			takes: [{ locationId: 1, lotId: null, quantity: 2 }],
			short: 3
		});
	});
});

describe('movingAverage', () => {
	it('weights old and new stock', () => {
		expect(movingAverage(10, 100, 10, 200)).toBe(150);
	});
	it('takes the new cost when nothing is on hand', () => {
		expect(movingAverage(0, 999, 5, 42)).toBe(42);
		expect(movingAverage(-3, 999, 5, 42)).toBe(42);
	});
	it('keeps four places', () => {
		expect(movingAverage(1, 0, 2, 10 / 3)).toBe(2.2222);
	});
});

describe('isExpired', () => {
	it('is in date on the day it expires', () => {
		expect(isExpired('2026-09-28', today)).toBe(false);
		expect(isExpired('2026-09-27', today)).toBe(true);
		expect(isExpired(null, today)).toBe(false);
	});
});

describe('ethiopianFiscalYear and documentNumber', () => {
	it('opens the next fiscal year on Hamle 1', () => {
		// 8 July 2025 is Hamle 1, 2017 E.C.: FY 2018. 7 July 2025 is Sene 30, 2017: FY 2017.
		expect(ethiopianFiscalYear('2025-07-08')).toBe(2018);
		expect(ethiopianFiscalYear('2025-07-07')).toBe(2017);
	});
	it('formats numbers', () => {
		expect(documentNumber('receipt', 2019, 42)).toBe('AM-GRN-2019-00042');
		expect(documentNumber('purchase_order', 2019, 3)).toBe('AM-PO-2019-00003');
	});
});

describe('vatWithin', () => {
	it('takes 15% out of a VAT-inclusive price', () => {
		expect(Math.round(vatWithin(115, 15) * 100) / 100).toBe(15);
	});
});

describe('allocate with exactLot', () => {
	const today = '2026-09-28';
	it('reads a null lot as "the stock with no lot", not "any lot"', () => {
		const candidates = [
			{
				lotId: 7,
				locationId: 1,
				quantity: 10,
				expiryDate: '2026-12-01',
				status: 'available' as const
			},
			{ lotId: null, locationId: 1, quantity: 4, expiryDate: null, status: null }
		];
		const any = allocate(candidates, 3, { today, lotId: null });
		expect(any.takes).toEqual([{ locationId: 1, lotId: 7, quantity: 3 }]);
		const exact = allocate(candidates, 3, { today, lotId: null, exactLot: true });
		expect(exact.takes).toEqual([{ locationId: 1, lotId: null, quantity: 3 }]);
		expect(allocate(candidates, 9, { today, lotId: null, exactLot: true }).short).toBe(5);
	});
});
