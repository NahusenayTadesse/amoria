import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '$lib/server/db';
import { orders, pushSubscription, registration } from '$lib/server/db/schema';
import {
	actorFor,
	dayFromNow,
	guest,
	makeCourse,
	makeIntake,
	makeProduct,
	makeStaff,
	resetDb
} from '$lib/server/testing/db';
import { createFromCart, setOrderStatus } from './orders';
import { recordManualPayment } from './payments';
import { register, setRegistrationStatus } from './school';
import { notifyPaid, sendClassReminders, subscribe, unsubscribe } from './push';

// Nothing is sent: the push service is replaced, and what it was asked to send is inspected.
vi.mock('web-push', () => ({
	default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() }
}));
const send = vi.mocked(webpush.sendNotification);

beforeEach(async () => {
	await resetDb();
	send.mockReset();
	send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
});

const phone = (n: number) => ({
	endpoint: `https://push.example/send/${n}`,
	keys: { p256dh: `key-${n}`, auth: `auth-${n}` }
});

/** What the first notification sent said (the payload is JSON). */
const sent = (call = 0) => JSON.parse(send.mock.calls[call][1] as string);

async function placeOrder() {
	const productId = await makeProduct({ stockQty: 5 });
	return createFromCart({
		lines: [{ productId, qty: 1 }],
		contact: guest(),
		fulfilment: { type: 'pickup' },
		notes: null,
		sourceId: null
	});
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('subscribe', () => {
	it('keeps one row per phone and record, and stops at five phones', async () => {
		const { id } = await placeOrder();
		for (let n = 1; n <= 5; n++) expect(await subscribe('order', id, phone(n), 'en')).toBe(true);
		expect(await subscribe('order', id, phone(1), 'am')).toBe(true); // the same phone again
		expect(await subscribe('order', id, phone(6), 'en')).toBe(false);

		const rows = await db.select().from(pushSubscription);
		expect(rows).toHaveLength(5);
		expect(rows.find((r) => r.endpoint === phone(1).endpoint)?.locale).toBe('am');
	});

	it('unsubscribe removes only that phone from that record', async () => {
		const { id } = await placeOrder();
		await subscribe('order', id, phone(1), 'en');
		await subscribe('order', id, phone(2), 'en');
		await unsubscribe('order', id, phone(1).endpoint);
		const rows = await db.select().from(pushSubscription);
		expect(rows.map((r) => r.endpoint)).toEqual([phone(2).endpoint]);
	});
});

describe('order updates', () => {
	it('tells the phones following an order when staff mark it ready, in their language', async () => {
		const { id, token } = await placeOrder();
		await subscribe('order', id, phone(1), 'en');
		await subscribe('order', id, phone(2), 'am');
		const staff = await makeStaff();
		await db.update(orders).set({ status: 'preparing' }).where(eq(orders.id, id));

		await setOrderStatus(id, 'ready', actorFor(staff));
		await flush();

		expect(send).toHaveBeenCalledTimes(2);
		const bodies = [sent(0), sent(1)];
		expect(bodies.map((b) => b.body).sort()).toEqual(['Your order is ready.', 'ትዕዛዝዎ ዝግጁ ነው።']);
		expect(bodies.find((b) => b.body.startsWith('Your'))!.url).toBe(`/o/${token}`);
		expect(bodies.find((b) => b.body.startsWith('ትዕ'))!.url).toBe(`/am/o/${token}`);
	});

	it('says nothing when nobody follows, and never for a different order', async () => {
		const first = await placeOrder();
		const second = await placeOrder();
		await subscribe('order', first.id, phone(1), 'en');
		const staff = await makeStaff();
		await db.update(orders).set({ status: 'preparing' }).where(eq(orders.id, second.id));
		await setOrderStatus(second.id, 'ready', actorFor(staff));
		await flush();
		expect(send).not.toHaveBeenCalled();
	});

	it('forgets a phone the push service says is gone', async () => {
		const { id } = await placeOrder();
		await subscribe('order', id, phone(1), 'en');
		send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

		notifyPaid('order', id);
		await flush();

		expect(await db.select().from(pushSubscription)).toHaveLength(0);
	});

	it('announces a payment once the order is paid', async () => {
		const { id } = await placeOrder();
		await subscribe('order', id, phone(1), 'en');
		await recordManualPayment(
			'order',
			id,
			{ provider: 'cash', reference: null, receiptFile: null },
			actorFor(null)
		);
		await flush();
		expect(sent().body).toBe('We received your payment. Thank you!');
	});
});

describe('registration updates and reminders', () => {
	async function confirmedStudent(startsInDays: number) {
		const courseId = await makeCourse();
		const intakeId = await makeIntake(courseId, { startDate: dayFromNow(startsInDays) });
		const { id } = await register({ intakeId, contact: guest(), sourceId: null });
		await recordManualPayment(
			'registration',
			id,
			{ provider: 'cash', reference: null, receiptFile: null },
			actorFor(null)
		);
		await flush(); // the "paid" push goes out in the background; let it finish before anyone subscribes
		return id;
	}

	it('confirms a seat to the student', async () => {
		const id = await confirmedStudent(7);
		await subscribe('registration', id, phone(1), 'en');
		const staff = await makeStaff();
		await setRegistrationStatus(id, 'cancelled', actorFor(staff));
		await flush();
		expect(sent().body).toBe('Your registration was cancelled.');
	});

	it('reminds a confirmed student the day before the class, once', async () => {
		const id = await confirmedStudent(1);
		await subscribe('registration', id, phone(1), 'en');

		expect(await sendClassReminders()).toBe(1);
		expect(sent().body).toBe('Your class starts tomorrow.');
		expect(await sendClassReminders()).toBe(0);
		expect(send).toHaveBeenCalledTimes(1);

		const [row] = await db.select().from(pushSubscription);
		expect(row.remindedAt).not.toBeNull();
	});

	it('does not remind for a class that starts later, or an unconfirmed seat', async () => {
		const later = await confirmedStudent(5);
		await subscribe('registration', later, phone(1), 'en');
		const courseId = await makeCourse();
		const intakeId = await makeIntake(courseId, { startDate: dayFromNow(1) });
		const { id: unpaid } = await register({ intakeId, contact: guest(), sourceId: null });
		await subscribe('registration', unpaid, phone(2), 'en');

		expect(await sendClassReminders()).toBe(0);
		expect(send).not.toHaveBeenCalled();
		const [row] = await db.select().from(registration).where(eq(registration.id, unpaid));
		expect(row.status).toBe('pending_payment');
	});
});
