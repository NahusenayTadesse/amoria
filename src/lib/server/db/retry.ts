import { db } from '$lib/server/db';

/**
 * `db.transaction`, retried when the database gives up on it because of a concurrent transaction
 * rather than because of anything wrong with it:
 *
 *   - `ER_LOCK_DEADLOCK` — two transactions each waiting on the other; InnoDB kills one.
 *   - `ER_CHECKREAD` — MariaDB 11.6+ snapshot isolation: a row this transaction read without a lock
 *     was changed and committed by another before this one locked it (two checkouts for the same
 *     product). MySQL and older MariaDB report the same situation as a deadlock or not at all.
 *
 * The transaction was rolled back, so running it again from the start is safe, and the second run
 * sees the other transaction's result — the last unit gone — and refuses properly. Found by
 * `orders.db.test.ts` ("sells the last unit to exactly one of two customers").
 *
 * Only for transactions whose body is database work alone: anything outside the database (an HTTP
 * call, a file write) would run twice.
 */
const RETRYABLE = new Set(['ER_LOCK_DEADLOCK', 'ER_CHECKREAD']);
const ATTEMPTS = 3;

export async function transaction<T>(body: Parameters<typeof db.transaction<T>>[0]): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await db.transaction(body);
		} catch (err) {
			if (attempt >= ATTEMPTS || !isConflict(err)) throw err;
			// A short, growing, jittered pause so the two contenders do not collide again.
			await new Promise((resolve) => setTimeout(resolve, attempt * 20 + Math.random() * 30));
		}
	}
}

/** A deadlock or snapshot conflict, however deep Drizzle wrapped the driver's error. */
export function isConflict(err: unknown): boolean {
	for (
		let e = err as { code?: string; cause?: unknown } | undefined, depth = 0;
		e && depth < 5;
		depth++
	) {
		if (e.code && RETRYABLE.has(e.code)) return true;
		e = e.cause as typeof e;
	}
	return false;
}
