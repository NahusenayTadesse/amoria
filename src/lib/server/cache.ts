/**
 * A small in-memory cache with a TTL and a cap on entries (§3.3): catalog lists, settings, the set
 * of public image names. Nothing per-user goes in here, and nothing that must not be lost — the
 * process can be stopped by Passenger at any time.
 *
 * Entries carry tags so a write can drop everything it affects: saving a product calls
 * `invalidate('catalog')`.
 *
 * Non-goal: sharing across processes. Passenger is pinned to one instance (§3.3); with two, a
 * write in one would leave the other serving stale entries until their TTL ran out.
 */

type Entry = { value: unknown; expiresAt: number; tags: string[] };

const MAX_ENTRIES = 200;
const entries = new Map<string, Entry>();

/**
 * The cached value for `key`, or `load()`'s result, cached for `ttlMs`.
 *
 * Concurrent misses each call `load()`; for the handful of cheap reads cached here that is
 * simpler than coalescing them and costs a query or two at most.
 */
export async function cached<T>(
	key: string,
	options: { ttlMs: number; tags?: string[] },
	load: () => Promise<T>
): Promise<T> {
	const hit = entries.get(key);
	if (hit && hit.expiresAt > Date.now()) return hit.value as T;

	const value = await load();

	// A Map iterates in insertion order, so the first key is the oldest.
	if (!entries.has(key) && entries.size >= MAX_ENTRIES) {
		entries.delete(entries.keys().next().value!);
	}
	entries.set(key, { value, expiresAt: Date.now() + options.ttlMs, tags: options.tags ?? [] });

	return value;
}

/** Drops every entry carrying `tag`. */
export function invalidate(tag: string) {
	for (const [key, entry] of entries) {
		if (entry.tags.includes(tag)) entries.delete(key);
	}
}

/**
 * Wraps form actions so that after each one runs the given cache tags are dropped — for CRUD
 * screens whose writes change what the storefront shows (`invalidating(['catalog'], crud.actions)`).
 * Dropping on a refused write too costs one cache refill and keeps this simple.
 */
export function invalidating<A extends Record<string, (event: never) => unknown>>(
	tags: string[],
	actions: A
): A {
	return Object.fromEntries(
		Object.entries(actions).map(([name, action]) => [
			name,
			async (event: never) => {
				try {
					return await action(event);
				} finally {
					for (const tag of tags) invalidate(tag);
				}
			}
		])
	) as A;
}
