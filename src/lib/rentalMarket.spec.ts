import { describe, expect, it } from 'vitest';
import { fixedPrice, rentalDays } from './rentalMarket';

describe('rentalDays', () => {
	it('counts both ends', () => {
		expect(rentalDays('2026-10-20', '2026-10-20')).toBe(1);
		expect(rentalDays('2026-10-20', '2026-10-22')).toBe(3);
	});

	it('crosses a month end', () => {
		expect(rentalDays('2026-10-30', '2026-11-02')).toBe(4);
	});

	it('is 0 when the end is before the start', () => {
		expect(rentalDays('2026-10-22', '2026-10-20')).toBe(0);
	});
});

describe('fixedPrice', () => {
	it('charges a day rate for every day and item, plus the deposit per item', () => {
		expect(fixedPrice({ price: 500, unit: 'day', deposit: 100, qty: 2, days: 3 })).toEqual({
			units: 3,
			subtotal: 3000,
			deposit: 200,
			total: 3200
		});
	});

	it('charges an event or item price once, whatever the days', () => {
		expect(fixedPrice({ price: 12000, unit: 'event', deposit: 0, qty: 1, days: 2 }).total).toBe(
			12000
		);
		expect(fixedPrice({ price: 25.5, unit: 'item', deposit: 0, qty: 200, days: 1 }).total).toBe(
			5100
		);
	});

	it('charges hours for an hourly listing, at least one', () => {
		expect(fixedPrice({ price: 800, unit: 'hour', deposit: 0, qty: 1, days: 1, hours: 4 })).toEqual(
			{ units: 4, subtotal: 3200, deposit: 0, total: 3200 }
		);
		expect(fixedPrice({ price: 800, unit: 'hour', deposit: 0, qty: 1, days: 1 }).units).toBe(1);
	});
});
