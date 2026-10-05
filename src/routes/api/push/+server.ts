import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { orders, registration } from '$lib/server/db/schema';
import {
	subscribe,
	unsubscribe,
	vapidPublicKey,
	type Subscription
} from '$lib/server/services/push';

/**
 * Follow or unfollow an order or a registration from a phone (Web Push). Anonymous, like the
 * pages these come from: whoever holds the record's link token may follow it, and that is all a
 * subscription can do, receive that record's updates.
 *
 *   GET     → { key }  the public VAPID key a browser subscribes with (null when push is off)
 *   POST    { kind, token, subscription, locale }
 *   DELETE  { kind, token, endpoint }
 */

type Kind = 'order' | 'registration';

async function targetOf(kind: unknown, token: unknown): Promise<{ kind: Kind; id: number }> {
	if (
		(kind !== 'order' && kind !== 'registration') ||
		typeof token !== 'string' ||
		token.length > 40
	) {
		error(400, 'Bad request');
	}
	const table = kind === 'order' ? orders : registration;
	const [row] = await db.select({ id: table.id }).from(table).where(eq(table.publicToken, token));
	if (!row) error(404, 'Not found');
	return { kind, id: row.id };
}

function parseSubscription(value: unknown): Subscription {
	const s = value as Partial<Subscription> | null;
	const ok =
		typeof s?.endpoint === 'string' &&
		s.endpoint.startsWith('https://') &&
		s.endpoint.length <= 500 &&
		typeof s.keys?.p256dh === 'string' &&
		s.keys.p256dh.length <= 255 &&
		typeof s.keys?.auth === 'string' &&
		s.keys.auth.length <= 64;
	if (!ok) error(400, 'Bad subscription');
	return s as Subscription;
}

export const GET = () => json({ key: vapidPublicKey() });

export const POST = async ({ request }) => {
	if (!vapidPublicKey()) error(503, 'Notifications are not available');
	const body = await request.json().catch(() => error(400, 'Bad request'));
	const target = await targetOf(body.kind, body.token);
	const subscription = parseSubscription(body.subscription);
	const locale = body.locale === 'am' ? 'am' : 'en';

	if (!(await subscribe(target.kind, target.id, subscription, locale))) {
		error(429, 'Too many devices are following this already');
	}
	return json({ ok: true });
};

export const DELETE = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Bad request'));
	const target = await targetOf(body.kind, body.token);
	if (typeof body.endpoint !== 'string') error(400, 'Bad request');
	await unsubscribe(target.kind, target.id, body.endpoint);
	return json({ ok: true });
};
