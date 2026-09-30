import { describe, expect, it } from 'vitest';
import { lineTotal, roundBirr, sumBirr } from './money';

describe('birr arithmetic', () => {
	it('adds in cents, so decimals never drift', () => {
		// 0.1 + 0.2 is 0.30000000000000004 in floating point.
		expect(sumBirr([0.1, 0.2])).toBe(0.3);
		expect(sumBirr(Array.from({ length: 10 }, () => 19.99))).toBe(199.9);
		expect(sumBirr([])).toBe(0);
	});

	it('multiplies a unit price by a quantity exactly', () => {
		expect(lineTotal(19.99, 3)).toBe(59.97);
		expect(lineTotal(1450, 2)).toBe(2900);
		expect(lineTotal(0.07, 100)).toBe(7);
	});

	it('rounds to two places the way a decimal(12,2) column stores it', () => {
		expect(roundBirr(10.004)).toBe(10);
		expect(roundBirr(10.006)).toBe(10.01);
		expect(roundBirr(1300)).toBe(1300);
	});
});
