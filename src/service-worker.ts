/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Makes Amoria installable and keeps it usable on a bad connection.
 *
 *  - The build's own files (hashed, immutable) and the brand icons are cached when the worker installs.
 *  - Photos are served from the cache and refreshed behind the visitor's back.
 *  - The public pages (home, shop, school, about, contact) are network first, and fall back to the
 *    last copy the visitor saw, then to `/offline`.
 *  - Everything personal or live is left to the network, never stored: the dashboard, login,
 *    payments, order status (`/o/…`), registration and checkout, and every API and data request.
 */
import { build, files, version } from '$service-worker';
import { SYNC_TAG, flushQueue } from '$lib/offlineQueue';

const sw = self as unknown as ServiceWorkerGlobalScope;

const SHELL = `shell-${version}`;
const IMAGES = 'images-v1';
const PAGES = 'pages-v1';
const KEEP = new Set([SHELL, IMAGES, PAGES]);
const MAX_IMAGES = 150;
const MAX_PAGES = 30;
const PAGE_WAIT_MS = 4000;

/** Fetched when the worker installs, so they are there offline before the visitor opens them. */
const WARM_PAGES = ['/', '/shop', '/school', '/about', '/contact', '/decor/quote'];

const shell = [
	...build,
	...files.filter((file) => /^\/(manifest\.webmanifest|brand\/(logo\.png|icons\/.+))$/.test(file))
];

/** Pages worth keeping for offline: public, the same for everyone. `/am/…` is the Amharic copy. */
const CACHEABLE_PAGE = /^(\/am)?(\/(shop|school|about|contact|decor)(\/.*)?)?\/?$/;
/** Never answered from a cache. */
const NETWORK_ONLY =
	/^(\/am)?\/(dashboard|api|login|logout|setup|pay|o|reg|buy)(\/|$)|\/__data\.json$/;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL);
			await cache.addAll(shell);
			// The offline page is prerendered; a miss must not stop the worker installing.
			await cache.add('/offline').catch(() => undefined);
			// The public pages too, so the shop and the school open with no signal from the first visit.
			const pages = await caches.open(PAGES);
			await Promise.all(WARM_PAGES.map((path) => pages.add(path).catch(() => undefined)));
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (!KEEP.has(key)) await caches.delete(key);
			await sw.clients.claim();
		})()
	);
});

/** Drops the oldest entries once a cache holds more than `max`. */
async function trim(name: string, max: number) {
	const cache = await caches.open(name);
	const keys = await cache.keys();
	for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

/** Cached copy straight away, fresh copy fetched for next time. */
async function staleWhileRevalidate(request: Request) {
	const cache = await caches.open(IMAGES);
	const cached = await cache.match(request);
	const fresh = fetch(request)
		.then((response) => {
			if (response.ok) {
				cache.put(request, response.clone()).then(() => trim(IMAGES, MAX_IMAGES));
			}
			return response;
		})
		.catch(() => undefined);
	return cached ?? (await fresh) ?? Response.error();
}

async function page(request: Request, path: string) {
	const cache = await caches.open(PAGES);
	const saved = await cache.match(request);

	const network = fetch(request).then((response) => {
		if (response.ok && !response.redirected && CACHEABLE_PAGE.test(path)) {
			cache.put(request, response.clone()).then(() => trim(PAGES, MAX_PAGES));
		}
		return response;
	});

	try {
		// With a saved copy, a slow network yields to it after a few seconds. Without one, wait: a
		// slow page is better than telling an online visitor they are offline.
		return saved
			? await Promise.race([
					network,
					new Promise<never>((_, reject) => setTimeout(reject, PAGE_WAIT_MS))
				])
			: await network;
	} catch {
		return saved ?? (await caches.match('/offline')) ?? new Response('Offline', { status: 503 });
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (NETWORK_ONLY.test(url.pathname)) return;

	if (shell.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
	} else if (request.mode === 'navigate') {
		event.respondWith(page(request, url.pathname));
	} else if (
		request.destination === 'image' ||
		request.destination === 'font' ||
		/^\/(images|brand|media|fonts)\//.test(url.pathname)
	) {
		event.respondWith(staleWhileRevalidate(request));
	}
});

/** A push from the server: show it, with the page it is about one tap away. */
sw.addEventListener('push', (event) => {
	const data = event.data?.json() as
		{ title?: string; body?: string; url?: string; tag?: string } | undefined;
	if (!data) return;
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'Amoria', {
			body: data.body,
			tag: data.tag,
			icon: '/brand/icons/icon-192.png',
			badge: '/brand/icons/favicon-32.png',
			data: { url: data.url ?? '/' }
		})
	);
});

/** Tapping it focuses the open Amoria window on that page, or opens one. */
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url ?? '/', sw.location.origin).href;
	event.waitUntil(
		(async () => {
			const open = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of open) {
				if ('navigate' in client && 'focus' in client) {
					await client.navigate(url);
					return client.focus();
				}
			}
			return sw.clients.openWindow(url);
		})()
	);
});

/** The connection is back (Chromium's Background Sync): send what was queued offline. */
sw.addEventListener('sync', (event) => {
	const syncEvent = event as ExtendableEvent & { tag: string };
	if (syncEvent.tag !== SYNC_TAG) return;
	syncEvent.waitUntil(flushQueue().then(() => undefined));
});
