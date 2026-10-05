/**
 * Requests written with no signal, kept in the browser (IndexedDB) and sent when it is back.
 *
 * Used for the "Plan your décor" request: a person on a bad connection fills the form once and it
 * is not lost. Both the page (on the `online` event and at load) and the service worker (Background
 * Sync, where the browser has it; Safari does not) call `flushQueue`. Each entry carries its own
 * `clientRef`, which the server uses to treat a request sent twice as one.
 */

const DB_NAME = 'amoria-outbox';
const STORE = 'requests';
/** The endpoint a queued request is posted to, as JSON. */
export const QUOTE_ENDPOINT = '/api/quote';
/** The tag of the one Background Sync registration. */
export const SYNC_TAG = 'amoria-outbox';

export type QueuedRequest = { id: string; url: string; body: Record<string, unknown>; at: number };

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = work(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
}

/** Keeps a request until it has been sent. `id` is its `clientRef`. */
export async function enqueue(url: string, id: string, body: Record<string, unknown>) {
	await run('readwrite', (store) =>
		store.put({ id, url, body, at: Date.now() } satisfies QueuedRequest)
	);
}

export const queued = () => run<QueuedRequest[]>('readonly', (store) => store.getAll());
export const forget = (id: string) => run('readwrite', (store) => store.delete(id));

/**
 * Sends what is waiting, oldest first. An entry the server accepts, or refuses for good (a 4xx),
 * is dropped; a network failure or a 5xx leaves it for next time. Returns how many went through.
 */
export async function flushQueue(): Promise<number> {
	let sent = 0;
	const waiting = (await queued().catch(() => [])).sort((a, b) => a.at - b.at);
	for (const item of waiting) {
		try {
			const response = await fetch(item.url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(item.body)
			});
			if (response.status >= 500 || response.status === 429) return sent;
			await forget(item.id);
			if (response.ok) sent++;
		} catch {
			return sent; // still offline
		}
	}
	return sent;
}

/** Asks the browser to flush when the connection returns, even with the page closed. */
export async function requestBackgroundSync() {
	try {
		const registration = await navigator.serviceWorker.ready;
		await (
			registration as ServiceWorkerRegistration & {
				sync?: { register(tag: string): Promise<void> };
			}
		).sync?.register(SYNC_TAG);
	} catch {
		// No Background Sync here: the page flushes on `online` instead.
	}
}
