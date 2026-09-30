import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { auditLog, orders, payment } from '$lib/server/db/schema';
import {
	actorFor,
	guest,
	makeBankAccount,
	makeProduct,
	makeStaff,
	resetDb,
	setSettings,
	stockOf
} from '$lib/server/testing/db';
import { createFromCart, expireHolds } from '../orders';
import {
	confirmTransfer,
	PaymentStartError,
	reconcileStale,
	recordManualPayment,
	rejectTransfer,
	startChapa,
	submitTransfer,
	verify
} from './index';

/**
 * Chapa, stubbed at `fetch`: `initialize` hands back a checkout URL (or fails when told to), and
 * `verify/<txRef>` answers with whatever `chapaSays` holds for that reference.
 */
const chapa = {
	initializeFails: false,
	calls: [] as { url: string; body: Record<string, unknown> | null }[],
	answers: new Map<string, { status: number; body: unknown } | 'unreachable'>()
};

function chapaSays(txRef: string, data: Record<string, unknown>, status = 'success') {
	chapa.answers.set(txRef, {
		status: 200,
		body: { status, data: { tx_ref: txRef, currency: 'ETB', ...data } }
	});
}

beforeEach(async () => {
	await resetDb();
	chapa.initializeFails = false;
	chapa.calls = [];
	chapa.answers.clear();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = String(input);
			chapa.calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
			if (url.endsWith('/transaction/initialize')) {
				if (chapa.initializeFails) return new Response('{"message":"down"}', { status: 500 });
				return Response.json({
					status: 'success',
					data: { checkout_url: 'https://checkout.chapa.co/test/abc' }
				});
			}
			const txRef = decodeURIComponent(url.split('/transaction/verify/')[1] ?? '');
			const answer = chapa.answers.get(txRef);
			if (answer === 'unreachable') throw new TypeError('fetch failed');
			if (!answer)
				return Response.json({ status: 'failed', message: 'Invalid transaction' }, { status: 400 });
			return Response.json(answer.body, { status: answer.status });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

/** A waiting order for one gift. */
async function pendingOrder(price = 1300, stockQty = 5, contact = guest()) {
	const gift = await makeProduct({ price, stockQty });
	const placed = await createFromCart({
		lines: [{ productId: gift, qty: 1 }],
		contact,
		fulfilment: { type: 'pickup' },
		notes: null,
		sourceId: null
	});
	return { gift, id: placed.id, token: placed.token };
}

const orderStatus = async (id: number) =>
	(await db.select({ s: orders.status }).from(orders).where(eq(orders.id, id)))[0].s;

const paymentsOf = (orderId: number) =>
	db.select().from(payment).where(eq(payment.orderId, orderId));

/** Starts a Chapa attempt and returns its reference. */
async function started(orderId: number) {
	await startChapa('order', orderId, 'https://amoria.test');
	const [p] = await paymentsOf(orderId);
	return p.txRef;
}

describe('startChapa', () => {
	it('records the attempt before sending the customer to Chapa, for the amount on the order', async () => {
		const { id } = await pendingOrder(1300, 5, guest({ phone: '+251911234567', email: null }));
		const url = await startChapa('order', id, 'https://amoria.test');
		expect(url).toBe('https://checkout.chapa.co/test/abc');

		const [p] = await paymentsOf(id);
		expect(p).toMatchObject({
			provider: 'chapa',
			purpose: 'order',
			status: 'initiated',
			amount: 1300,
			checkoutUrl: url
		});
		expect(p.txRef).toMatch(new RegExp(`^am-o-${id}-[0-9a-f]{18}$`));

		const sent = chapa.calls[0].body!;
		expect(sent).toMatchObject({
			amount: '1300.00',
			currency: 'ETB',
			tx_ref: p.txRef,
			phone_number: '0911234567',
			callback_url: 'https://amoria.test/api/payments/chapa/callback',
			return_url: `https://amoria.test/pay/return?tx_ref=${encodeURIComponent(p.txRef)}`
		});
		// No email was given, so none is sent (Chapa accepts that).
		expect(sent.email).toBeUndefined();
	});

	it('refuses an order that is already paid', async () => {
		const { id } = await pendingOrder();
		await db.update(orders).set({ status: 'paid' }).where(eq(orders.id, id));
		await expect(startChapa('order', id, 'https://amoria.test')).rejects.toBeInstanceOf(
			WriteRefused
		);
		expect(await paymentsOf(id)).toHaveLength(0);
		expect(chapa.calls).toHaveLength(0);
	});

	it('keeps the order and marks the attempt failed when Chapa cannot start the checkout', async () => {
		chapa.initializeFails = true;
		const { id, token } = await pendingOrder();
		const err = await startChapa('order', id, 'https://amoria.test').catch((e) => e);
		expect(err).toBeInstanceOf(PaymentStartError);
		expect((err as PaymentStartError).statusPath).toBe(`/o/${token}`);
		expect((await paymentsOf(id))[0].status).toBe('failed');
		expect(await orderStatus(id)).toBe('pending_payment');
	});
});

describe('verify', () => {
	it('marks the payment and the order paid when Chapa confirms the amount', async () => {
		const { id, token } = await pendingOrder(1300);
		const txRef = await started(id);
		chapaSays(txRef, { status: 'success', amount: '1300.00', reference: 'APslQQ1zmnGft' });

		expect(await verify(txRef)).toEqual({ status: 'paid', statusPath: `/o/${token}` });
		const [p] = await paymentsOf(id);
		expect(p).toMatchObject({ status: 'success', providerRef: 'APslQQ1zmnGft' });
		expect(p.verifiedAt).not.toBeNull();
		expect(await orderStatus(id)).toBe('paid');
	});

	it('pays the order once however many confirmations race in', async () => {
		// An expired order makes a second onPaid visible: it would take the stock again.
		const { id, gift } = await pendingOrder(1300, 5);
		const txRef = await started(id);
		await db
			.update(orders)
			.set({ holdExpiresAt: new Date(Date.now() - 60_000) })
			.where(eq(orders.id, id));
		await expireHolds();
		expect(await stockOf(gift)).toBe(5);
		chapaSays(txRef, { status: 'success', amount: '1300.00' });

		const outcomes = await Promise.all([verify(txRef), verify(txRef), verify(txRef)]);
		expect(outcomes.every((o) => o.status === 'paid')).toBe(true);
		expect(await orderStatus(id)).toBe('paid');
		expect(await stockOf(gift)).toBe(4); // taken again exactly once
	});

	it('is a no-op for a reference that is already settled', async () => {
		const { id } = await pendingOrder();
		const txRef = await started(id);
		chapaSays(txRef, { status: 'success', amount: '1300.00' });
		await verify(txRef);
		const callsAfterFirst = chapa.calls.length;
		expect((await verify(txRef)).status).toBe('paid');
		// Settled payments are answered from the database, without asking Chapa again.
		expect(chapa.calls.length).toBe(callsAfterFirst);
	});

	it.each([
		['less money than asked', { status: 'success', amount: '1000.00' }],
		['a different currency', { status: 'success', amount: '1300.00', currency: 'USD' }],
		[
			'somebody else’s reference',
			{ status: 'success', amount: '1300.00', tx_ref: 'am-o-999-other' }
		]
	])('never settles a payment that reports %s', async (_label, data) => {
		const { id } = await pendingOrder(1300);
		const txRef = await started(id);
		chapaSays(txRef, data);

		expect(await verify(txRef)).toMatchObject({ status: 'pending', retryable: false });
		expect((await paymentsOf(id))[0].status).toBe('initiated');
		expect(await orderStatus(id)).toBe('pending_payment');
	});

	it('marks a failed payment failed and leaves the order payable', async () => {
		const { id } = await pendingOrder();
		const txRef = await started(id);
		chapaSays(txRef, { status: 'failed', amount: '1300.00' });

		expect((await verify(txRef)).status).toBe('failed');
		expect((await paymentsOf(id))[0].status).toBe('failed');
		expect(await orderStatus(id)).toBe('pending_payment');
	});

	it('says "ask again later" when the customer has not finished, or Chapa is unreachable', async () => {
		const { id } = await pendingOrder();
		const txRef = await started(id);
		// Unknown to Chapa yet: its 400 "Invalid transaction".
		expect(await verify(txRef)).toMatchObject({ status: 'pending', retryable: true });

		chapa.answers.set(txRef, 'unreachable');
		expect(await verify(txRef)).toMatchObject({ status: 'pending', retryable: true });
		expect((await paymentsOf(id))[0].status).toBe('initiated');
	});

	it('knows nothing of a reference it never issued', async () => {
		expect(await verify('am-o-1-made-up')).toEqual({
			status: 'pending',
			statusPath: null,
			retryable: false
		});
	});
});

describe('bank transfers', () => {
	it('records the receipt as a payment waiting for staff, and holds the order for the review', async () => {
		const account = await makeBankAccount();
		const { id } = await pendingOrder(1300);
		await submitTransfer('order', id, { bankAccountId: account, receiptFile: 'receipt.png' });

		const [p] = await paymentsOf(id);
		expect(p).toMatchObject({
			provider: 'bank_transfer',
			status: 'initiated',
			amount: 1300,
			bankAccountId: account,
			receiptFile: 'receipt.png'
		});
		const [order] = await db.select().from(orders).where(eq(orders.id, id));
		expect(order.holdExpiresAt).toBeNull();
		expect(order.status).toBe('pending_payment');
	});

	it('refuses an account that is not shown at checkout', async () => {
		const hidden = await makeBankAccount({ status: false });
		const { id } = await pendingOrder();
		const err = await submitTransfer('order', id, {
			bankAccountId: hidden,
			receiptFile: 'r.png'
		}).catch((e) => e);
		expect(err).toBeInstanceOf(WriteRefused);
		expect((err as WriteRefused).field).toBe('bankAccountId');
		expect(await paymentsOf(id)).toHaveLength(0);
	});

	it('refuses a receipt for an order that is already paid', async () => {
		const account = await makeBankAccount();
		const { id } = await pendingOrder();
		await db.update(orders).set({ status: 'paid' }).where(eq(orders.id, id));
		await expect(
			submitTransfer('order', id, { bankAccountId: account, receiptFile: 'r.png' })
		).rejects.toBeInstanceOf(WriteRefused);
	});

	it('confirming the receipt pays the order, records who checked it, and cannot be done twice', async () => {
		const staff = await makeStaff();
		const account = await makeBankAccount();
		const { id } = await pendingOrder();
		await submitTransfer('order', id, { bankAccountId: account, receiptFile: 'r.png' });
		const [p] = await paymentsOf(id);

		await confirmTransfer(p.id, actorFor(staff));
		const [after] = await paymentsOf(id);
		expect(after).toMatchObject({ status: 'success', recordedBy: staff });
		expect(after.verifiedAt).not.toBeNull();
		expect(await orderStatus(id)).toBe('paid');

		const audit = await db
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.tableName, 'payment'), eq(auditLog.recordId, String(p.id))));
		expect(audit).toHaveLength(1);
		expect(audit[0].userId).toBe(staff);

		await expect(confirmTransfer(p.id, actorFor(staff))).rejects.toThrow(/already been dealt with/);
	});

	it('will not confirm a Chapa payment as if it were a transfer', async () => {
		const { id } = await pendingOrder();
		await started(id);
		const [p] = await paymentsOf(id);
		await expect(confirmTransfer(p.id, actorFor(null))).rejects.toThrow(/not a transfer receipt/);
	});

	it('rejecting the receipt gives the customer a fresh hold to pay again', async () => {
		await setSettings({ holdMinutes: 45 });
		const account = await makeBankAccount();
		const { id } = await pendingOrder();
		await submitTransfer('order', id, { bankAccountId: account, receiptFile: 'r.png' });
		const [p] = await paymentsOf(id);

		const before = Date.now();
		await rejectTransfer(p.id, 'Amount did not match the statement', actorFor(null));

		const [after] = await paymentsOf(id);
		expect(after.status).toBe('failed');
		expect(after.verifyPayload).toBe('Rejected: Amount did not match the statement');
		const [order] = await db.select().from(orders).where(eq(orders.id, id));
		expect(order.status).toBe('pending_payment');
		const holdMs = order.holdExpiresAt!.getTime() - before;
		expect(holdMs).toBeGreaterThan(44 * 60_000);
		expect(holdMs).toBeLessThan(46 * 60_000);
	});

	it('keeps the order held while another receipt is still waiting', async () => {
		const account = await makeBankAccount();
		const { id } = await pendingOrder();
		await submitTransfer('order', id, { bankAccountId: account, receiptFile: 'first.png' });
		await submitTransfer('order', id, { bankAccountId: account, receiptFile: 'second.png' });
		const [second, first] = await paymentsOf(id).then((rows) => rows.sort((a, b) => b.id - a.id));

		await rejectTransfer(first.id, 'Blurry', actorFor(null));
		const [order] = await db.select().from(orders).where(eq(orders.id, id));
		expect(order.holdExpiresAt).toBeNull();
		expect(second.status).toBe('initiated');
	});
});

describe('recordManualPayment', () => {
	it('records money taken in person for the full amount and pays the order', async () => {
		const staff = await makeStaff();
		const { id } = await pendingOrder(1300);
		await recordManualPayment(
			'order',
			id,
			{ provider: 'cash', reference: null, receiptFile: null },
			actorFor(staff)
		);

		const [p] = await paymentsOf(id);
		expect(p).toMatchObject({
			provider: 'cash',
			status: 'success',
			amount: 1300,
			recordedBy: staff
		});
		expect(await orderStatus(id)).toBe('paid');
	});

	it('refuses an order that can no longer be paid', async () => {
		const { id } = await pendingOrder();
		await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, id));
		await expect(
			recordManualPayment(
				'order',
				id,
				{ provider: 'cash', reference: null, receiptFile: null },
				actorFor(null)
			)
		).rejects.toBeInstanceOf(WriteRefused);
		expect(await paymentsOf(id)).toHaveLength(0);
	});
});

describe('reconcileStale', () => {
	it('settles Chapa attempts nobody came back for, and leaves fresh ones alone', async () => {
		const stale = await pendingOrder(1300, 5, guest({ phone: '+251911000011' }));
		const fresh = await pendingOrder(1300, 5, guest({ phone: '+251911000022' }));
		const staleRef = await started(stale.id);
		const freshRef = await started(fresh.id);
		await db
			.update(payment)
			.set({ createdAt: new Date(Date.now() - 15 * 60_000) })
			.where(eq(payment.txRef, staleRef));
		chapaSays(staleRef, { status: 'success', amount: '1300.00' });
		chapaSays(freshRef, { status: 'success', amount: '1300.00' });

		expect(await reconcileStale()).toBe(1);
		expect(await orderStatus(stale.id)).toBe('paid');
		expect(await orderStatus(fresh.id)).toBe('pending_payment');
	});
});
