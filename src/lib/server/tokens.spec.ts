import { describe, expect, it } from 'vitest';
import { formatRef, newTxRef, publicToken } from './tokens';

describe('public tokens', () => {
	it('are 22 url-safe characters (128 random bits) and never repeat', () => {
		const tokens = new Set(Array.from({ length: 1000 }, publicToken));
		expect(tokens.size).toBe(1000);
		for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
	});
});

describe('refs', () => {
	it('format the human number from the id', () => {
		expect(formatRef('order', 123)).toBe('AM-O-000123');
		expect(formatRef('rental', 1)).toBe('AM-R-000001');
		expect(formatRef('quote', 1_234_567)).toBe('AM-Q-1234567');
	});
});

describe('Chapa references', () => {
	it('name the record, are unguessable, and fit the column', () => {
		const ref = newTxRef('o', 42);
		expect(ref).toMatch(/^am-o-42-[0-9a-f]{18}$/);
		expect(ref.length).toBeLessThanOrEqual(64);
		expect(newTxRef('o', 42)).not.toBe(ref);
	});
});
