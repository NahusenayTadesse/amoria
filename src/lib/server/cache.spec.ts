import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, invalidate, invalidating } from './cache';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

let n = 0;
const key = () => `spec:${++n}`;

describe('cached', () => {
	it('loads once and serves the stored value until it expires', async () => {
		const k = key();
		const load = vi.fn(async () => 'value');
		expect(await cached(k, { ttlMs: 1000 }, load)).toBe('value');
		expect(await cached(k, { ttlMs: 1000 }, load)).toBe('value');
		expect(load).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1001);
		await cached(k, { ttlMs: 1000 }, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('drops everything carrying a tag, and nothing else', async () => {
		const tagged = key();
		const other = key();
		const load = vi.fn(async () => Math.random());
		const a = await cached(tagged, { ttlMs: 60_000, tags: ['catalog'] }, load);
		const b = await cached(other, { ttlMs: 60_000, tags: ['settings'] }, load);

		invalidate('catalog');
		expect(await cached(tagged, { ttlMs: 60_000, tags: ['catalog'] }, load)).not.toBe(a);
		expect(await cached(other, { ttlMs: 60_000, tags: ['settings'] }, load)).toBe(b);
	});

	it('is bounded: it never holds more than 200 entries', async () => {
		const first = key();
		const load = vi.fn(async () => 1);
		await cached(first, { ttlMs: 60_000 }, load);
		for (let i = 0; i < 200; i++) await cached(key(), { ttlMs: 60_000 }, async () => i);
		// The oldest entry was evicted to make room, so it loads again.
		await cached(first, { ttlMs: 60_000 }, load);
		expect(load).toHaveBeenCalledTimes(2);
	});
});

describe('invalidating', () => {
	it('drops the tags after an action runs, even if the action throws', async () => {
		const k = key();
		const load = vi.fn(async () => 'fresh');
		await cached(k, { ttlMs: 60_000, tags: ['catalog'] }, load);

		const actions = invalidating(['catalog'], {
			ok: async () => 'done',
			broken: async () => {
				throw new Error('refused');
			}
		});
		expect(await actions.ok()).toBe('done');
		await cached(k, { ttlMs: 60_000, tags: ['catalog'] }, load);
		expect(load).toHaveBeenCalledTimes(2);

		await expect(actions.broken()).rejects.toThrow('refused');
		await cached(k, { ttlMs: 60_000, tags: ['catalog'] }, load);
		expect(load).toHaveBeenCalledTimes(3);
	});
});
