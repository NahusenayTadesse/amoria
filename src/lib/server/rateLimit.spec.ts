import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { takeToken } from './rateLimit';

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-01T09:00:00Z') }));
afterEach(() => vi.useRealTimers());

let n = 0;
const key = () => `test:${++n}`;

describe('takeToken', () => {
	it('allows a burst up to the capacity, then refuses', () => {
		const k = key();
		const results = Array.from({ length: 6 }, () => takeToken(k, { capacity: 5, perMinute: 5 }));
		expect(results).toEqual([true, true, true, true, true, false]);
	});

	it('refills over time at the given rate', () => {
		const k = key();
		for (let i = 0; i < 3; i++) takeToken(k, { capacity: 3, perMinute: 6 });
		expect(takeToken(k, { capacity: 3, perMinute: 6 })).toBe(false);
		vi.advanceTimersByTime(10_000); // 6 a minute = 1 every 10 s
		expect(takeToken(k, { capacity: 3, perMinute: 6 })).toBe(true);
		expect(takeToken(k, { capacity: 3, perMinute: 6 })).toBe(false);
	});

	it('keeps separate buckets per key (one busy visitor does not block another)', () => {
		const a = key();
		const b = key();
		takeToken(a, { capacity: 1, perMinute: 1 });
		expect(takeToken(a, { capacity: 1, perMinute: 1 })).toBe(false);
		expect(takeToken(b, { capacity: 1, perMinute: 1 })).toBe(true);
	});

	it('never refills past the capacity', () => {
		const k = key();
		takeToken(k, { capacity: 2, perMinute: 60 });
		vi.advanceTimersByTime(60 * 60_000);
		expect([1, 2, 3].map(() => takeToken(k, { capacity: 2, perMinute: 60 }))).toEqual([
			true,
			true,
			false
		]);
	});
});
