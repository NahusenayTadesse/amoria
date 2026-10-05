import { and, eq, inArray, isNull } from 'drizzle-orm';
import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { courseIntake, orders, pushSubscription, registration } from '$lib/server/db/schema';
import { m } from '$lib/paraglide/messages.js';
import { localizeHref } from '$lib/paraglide/runtime';
import type { PUSH_TARGETS } from '$lib/constants';

/**
 * Web Push for customers (the phone's own notifications, no account needed). A customer taps
 * "Get updates on this phone" on an order or registration page; from then on the server pushes
 * each change of that record to the phones that asked. Pushing is best effort and never inline:
 * callers do not wait for it and a failure never reaches them (§8's outbox is not built yet; when
 * it is, this becomes one of its channels).
 */

type Target = (typeof PUSH_TARGETS)[number];
type Locale = 'en' | 'am';

export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export type OrderEvent = 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type RegistrationEvent =
	'confirmed' | 'cancelled' | 'graduated' | 'not_graduated' | 'reminder';

/** At most this many phones follow one record: a household, not a crowd. */
const MAX_PER_TARGET = 5;

/** The public key a browser needs to subscribe; null when push is not set up on this server. */
export function vapidPublicKey(): string | null {
	return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : null;
}

/** The contact the push services may use: VAPID_SUBJECT, else the site's https origin, else a placeholder (dev). */
function vapidSubject(): string {
	const wanted = env.VAPID_SUBJECT || env.ORIGIN || '';
	return /^(https:|mailto:)/.test(wanted) ? wanted : 'mailto:push@amoria.invalid';
}

let configured = false;
function ready(): boolean {
	if (!vapidPublicKey()) return false;
	if (!configured) {
		webpush.setVapidDetails(vapidSubject(), env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
		configured = true;
	}
	return true;
}

/** Remembers that this browser follows the record. Following it twice is the same as once. */
export async function subscribe(
	target: Target,
	targetId: number,
	subscription: Subscription,
	locale: Locale
): Promise<boolean> {
	const existing = await db
		.select({ endpoint: pushSubscription.endpoint })
		.from(pushSubscription)
		.where(and(eq(pushSubscription.targetType, target), eq(pushSubscription.targetId, targetId)));
	if (
		existing.length >= MAX_PER_TARGET &&
		!existing.some((row) => row.endpoint === subscription.endpoint)
	) {
		return false;
	}

	await db
		.insert(pushSubscription)
		.values({
			endpoint: subscription.endpoint,
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth,
			locale,
			targetType: target,
			targetId
		})
		.onDuplicateKeyUpdate({
			set: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, locale }
		});
	return true;
}

export async function unsubscribe(target: Target, targetId: number, endpoint: string) {
	await db
		.delete(pushSubscription)
		.where(
			and(
				eq(pushSubscription.targetType, target),
				eq(pushSubscription.targetId, targetId),
				eq(pushSubscription.endpoint, endpoint)
			)
		);
}

type Row = typeof pushSubscription.$inferSelect;
type Payload = { title: string; body: string; url: string; tag: string };

/** Sends to each phone, and forgets the ones the push service says are gone (404 and 410). */
async function deliver(rows: Row[], payload: (locale: Locale) => Payload) {
	if (!rows.length || !ready()) return;
	const gone: number[] = [];

	await Promise.all(
		rows.map(async (row) => {
			try {
				await webpush.sendNotification(
					{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
					JSON.stringify(payload(row.locale)),
					{ TTL: 60 * 60 * 24 }
				);
			} catch (err) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 404 || status === 410) gone.push(row.id);
				else console.error('[push] send failed:', status ?? err);
			}
		})
	);

	if (gone.length) await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
}

const ORDER_TEXT: Record<OrderEvent, (locale: Locale) => string> = {
	paid: (locale) => m.push_order_paid({}, { locale }),
	preparing: (locale) => m.push_order_preparing({}, { locale }),
	ready: (locale) => m.push_order_ready({}, { locale }),
	completed: (locale) => m.push_order_completed({}, { locale }),
	cancelled: (locale) => m.push_order_cancelled({}, { locale })
};

const REGISTRATION_TEXT: Record<RegistrationEvent, (locale: Locale) => string> = {
	confirmed: (locale) => m.push_reg_confirmed({}, { locale }),
	cancelled: (locale) => m.push_reg_cancelled({}, { locale }),
	graduated: (locale) => m.push_reg_graduated({}, { locale }),
	not_graduated: (locale) => m.push_reg_not_graduated({}, { locale }),
	reminder: (locale) => m.push_reg_reminder({}, { locale })
};

/** An order changed: tell the phones following it. Never throws and need not be awaited. */
export async function notifyOrder(orderId: number, event: OrderEvent): Promise<void> {
	try {
		if (!ready()) return;
		const [order] = await db
			.select({ token: orders.publicToken })
			.from(orders)
			.where(eq(orders.id, orderId));
		if (!order) return;
		const rows = await db
			.select()
			.from(pushSubscription)
			.where(and(eq(pushSubscription.targetType, 'order'), eq(pushSubscription.targetId, orderId)));
		await deliver(rows, (locale) => ({
			title: 'Amoria',
			body: ORDER_TEXT[event](locale),
			url: localizeHref(`/o/${order.token}`, { locale }),
			tag: `order-${orderId}`
		}));
	} catch (err) {
		console.error('[push] notifyOrder failed:', err);
	}
}

/** A registration changed (or its result came in): the same, for the student's phones. */
export async function notifyRegistration(
	registrationId: number,
	event: RegistrationEvent
): Promise<void> {
	try {
		if (!ready()) return;
		const [reg] = await db
			.select({ token: registration.publicToken })
			.from(registration)
			.where(eq(registration.id, registrationId));
		if (!reg) return;
		const rows = await db
			.select()
			.from(pushSubscription)
			.where(
				and(
					eq(pushSubscription.targetType, 'registration'),
					eq(pushSubscription.targetId, registrationId)
				)
			);
		await deliver(rows, (locale) => ({
			title: 'Amoria',
			body: REGISTRATION_TEXT[event](locale),
			url: localizeHref(`/reg/${reg.token}`, { locale }),
			tag: `registration-${registrationId}`
		}));
	} catch (err) {
		console.error('[push] notifyRegistration failed:', err);
	}
}

/** A payment settled: the record it paid for is now paid (an order) or confirmed (a seat). */
export function notifyPaid(kind: string, recordId: number): void {
	if (kind === 'order') void notifyOrder(recordId, 'paid');
	else if (kind === 'registration') void notifyRegistration(recordId, 'confirmed');
}

/** The day after `day` (`YYYY-MM-DD`). */
function nextDay(day: string): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + 1);
	return date.toISOString().slice(0, 10);
}

/**
 * "Your class starts tomorrow", once per phone, to confirmed students whose class begins the next
 * Addis Ababa day (job `class-reminders`). Bounded per run; each phone is marked as reminded
 * after it is sent, so a rerun does not repeat it.
 */
export async function sendClassReminders(limit = 50): Promise<number> {
	if (!ready()) return 0;

	const due = await db
		.select({ sub: pushSubscription, token: registration.publicToken })
		.from(pushSubscription)
		.innerJoin(registration, eq(registration.id, pushSubscription.targetId))
		.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
		.where(
			and(
				eq(pushSubscription.targetType, 'registration'),
				isNull(pushSubscription.remindedAt),
				eq(registration.status, 'confirmed'),
				eq(courseIntake.startDate, nextDay(localToday()))
			)
		)
		.limit(limit);

	for (const { sub, token } of due) {
		await deliver([sub], (locale) => ({
			title: 'Amoria',
			body: REGISTRATION_TEXT.reminder(locale),
			url: localizeHref(`/reg/${token}`, { locale }),
			tag: `registration-${sub.targetId}`
		}));
		await db
			.update(pushSubscription)
			.set({ remindedAt: new Date() })
			.where(eq(pushSubscription.id, sub.id));
	}
	return due.length;
}
