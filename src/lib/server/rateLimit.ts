/**
 * An in-memory token bucket per key (usually `bucket:ip`), for the endpoints anyone can hit:
 * checkout, quote requests, sign-in, webhooks (§3.3).
 *
 * Bounded: buckets that have refilled completely carry no information, so they are dropped when
 * the map grows, and the map never holds more than `MAX_BUCKETS`.
 */

type Bucket = { tokens: number; updatedAt: number };

const MAX_BUCKETS = 5000;
const buckets = new Map<string, Bucket>();

/**
 * Takes one token from `key`'s bucket. `false` means the caller is over the limit.
 *
 *     if (!takeToken(`checkout:${getClientAddress()}`, { capacity: 10, perMinute: 10 })) …
 */
export function takeToken(
	key: string,
	{ capacity, perMinute }: { capacity: number; perMinute: number }
) {
	const now = Date.now();
	const refillPerMs = perMinute / 60_000;
	const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };

	bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
	bucket.updatedAt = now;

	if (bucket.tokens < 1) {
		buckets.set(key, bucket);
		return false;
	}

	bucket.tokens -= 1;
	buckets.set(key, bucket);
	if (buckets.size > MAX_BUCKETS) prune(now, refillPerMs, capacity);

	return true;
}

function prune(now: number, refillPerMs: number, capacity: number) {
	for (const [key, bucket] of buckets) {
		if (bucket.tokens + (now - bucket.updatedAt) * refillPerMs >= capacity) buckets.delete(key);
	}
	// Still full of active buckets: drop the oldest rather than grow without bound.
	while (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value!);
}
