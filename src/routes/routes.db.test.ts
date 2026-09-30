/**
 * The form actions, called the way SvelteKit calls them — real `FormData`, real services, the test
 * database — to catch wiring mistakes the service tests cannot see: a field read under the wrong
 * name, a phone not normalised, a permission check left off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { isHttpError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { orders, payment } from '$lib/server/db/schema';
import {
	guest,
	makeBankAccount,
	makeDeliveryArea,
	makeProduct,
	makeStaff,
	resetDb,
	setSettings,
	stockOf
} from '$lib/server/testing/db';
import { createFromCart } from '$lib/server/services/orders';
import { submitTransfer } from '$lib/server/services/payments';
import { actions as shopActions } from './(store)/shop/[[category]]/+page.server';
import { actions as orderActions } from './dashboard/orders/[id]/+page.server';

beforeEach(async () => {
	await resetDb();
	vi.stubGlobal(
		'fetch',
		vi.fn(async () =>
			Response.json({
				status: 'success',
				data: { checkout_url: 'https://checkout.chapa.co/test/route' }
			})
		)
	);
});
afterEach(() => vi.unstubAllGlobals());

let ip = 0;

/** A POST to an action, as the browser's form would send it. */
function post(
	url: string,
	fields: Record<string, string | Blob>,
	locals: Partial<App.Locals> = {},
	params = {}
) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.append(name, value);
	return {
		request: new Request(url, { method: 'POST', body }),
		url: new URL(url),
		params,
		locals: { permList: [], isSuperAdmin: false, ...locals },
		getClientAddress: () => `10.1.0.${++ip}`
	} as never;
}

/** The superforms message an action answered with, whether it succeeded or failed. */
function messageOf(result: unknown) {
	const r = result as {
		form?: { message?: unknown };
		data?: { form?: { message?: unknown } };
		status?: number;
	};
	return (r.form?.message ?? r.data?.form?.message) as {
		type: string;
		text: string;
		checkoutUrl?: string;
		statusPath?: string;
	};
}

const receiptFile = () => new File([new Uint8Array(500)], 'receipt.png', { type: 'image/png' });

describe('shop checkout action', () => {
	it('places the order from the posted bag, normalises the phone and sends the customer to Chapa', async () => {
		const gift = await makeProduct({ price: 1450, stockQty: 5 });
		const result = await shopActions.checkout(
			post('https://amoria.test/shop?/checkout', {
				cart: JSON.stringify([{ productId: gift, qty: 2 }]),
				name: 'Hana Tesfaye',
				phone: '0911 23 45 67',
				method: 'chapa'
			})
		);

		const msg = messageOf(result);
		expect(msg).toMatchObject({
			type: 'success',
			checkoutUrl: 'https://checkout.chapa.co/test/route'
		});
		const [order] = await db.select().from(orders);
		expect(msg.statusPath).toBe(`/o/${order.publicToken}`);
		expect(order).toMatchObject({
			contactPhone: '+251911234567',
			total: 2900,
			fulfilment: 'pickup'
		});
		expect(await stockOf(gift)).toBe(3);
		const [p] = await db.select().from(payment);
		expect(p).toMatchObject({ provider: 'chapa', status: 'initiated', amount: 2900 });
	});

	it('charges delivery from the area the customer chose', async () => {
		await setSettings({ freeDeliveryThreshold: 5000 });
		const area = await makeDeliveryArea({ fee: 200 });
		const gift = await makeProduct({ price: 1000 });
		await shopActions.checkout(
			post('https://amoria.test/shop?/checkout', {
				cart: JSON.stringify([{ productId: gift, qty: 1 }]),
				name: 'Hana Tesfaye',
				phone: '0911234567',
				fulfilment: 'delivery',
				deliveryAreaId: String(area),
				deliveryAddress: 'Near Edna Mall, 3rd floor',
				method: 'chapa'
			})
		);
		const [order] = await db.select().from(orders);
		expect(order).toMatchObject({ fulfilment: 'delivery', deliveryFee: 200, total: 1200 });
	});

	it('takes a transfer receipt, stores it privately and holds the order for staff', async () => {
		const account = await makeBankAccount();
		const gift = await makeProduct({ price: 500 });
		const result = await shopActions.checkout(
			post('https://amoria.test/shop?/checkout', {
				cart: JSON.stringify([{ productId: gift, qty: 1 }]),
				name: 'Hana Tesfaye',
				phone: '0911234567',
				method: 'transfer',
				bankAccountId: String(account),
				receipt: receiptFile()
			})
		);

		expect(messageOf(result)).toMatchObject({ type: 'success' });
		expect(messageOf(result).checkoutUrl).toBeUndefined();
		const [p] = await db.select().from(payment);
		expect(p).toMatchObject({
			provider: 'bank_transfer',
			status: 'initiated',
			bankAccountId: account
		});
		expect(p.receiptFile).toMatch(/\.png$/);
		const [order] = await db.select().from(orders);
		expect(order.holdExpiresAt).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('refuses a bag it cannot read, without placing anything', async () => {
		const result = await shopActions.checkout(
			post('https://amoria.test/shop?/checkout', {
				cart: 'not json',
				name: 'Hana Tesfaye',
				phone: '0911234567'
			})
		);
		expect(messageOf(result).type).toBe('error');
		expect(await db.select().from(orders)).toHaveLength(0);
	});

	it('refuses invalid details with a 400 and keeps the stock', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const result = (await shopActions.checkout(
			post('https://amoria.test/shop?/checkout', {
				cart: JSON.stringify([{ productId: gift, qty: 1 }]),
				name: 'H',
				phone: '123'
			})
		)) as { status: number };
		expect(result.status).toBe(400);
		expect(await stockOf(gift)).toBe(5);
	});

	it('passes a sold-out refusal through as a message the customer can act on', async () => {
		const gift = await makeProduct({ name: 'Coffee box', stockQty: 0 });
		const result = (await shopActions.checkout(
			post('https://amoria.test/shop?/checkout', {
				cart: JSON.stringify([{ productId: gift, qty: 1 }]),
				name: 'Hana Tesfaye',
				phone: '0911234567'
			})
		)) as { status: number };
		expect(result.status).toBe(409);
		expect(messageOf(result).text).toMatch(/Coffee box has just sold out/);
	});
});

describe('staff order actions', () => {
	async function orderWithReceipt() {
		const account = await makeBankAccount();
		const gift = await makeProduct();
		const placed = await createFromCart({
			lines: [{ productId: gift, qty: 1 }],
			contact: guest(),
			fulfilment: { type: 'pickup' },
			notes: null,
			sourceId: null
		});
		await submitTransfer('order', placed.id, { bankAccountId: account, receiptFile: 'r.png' });
		const [p] = await db.select().from(payment);
		return { id: placed.id, paymentId: p.id };
	}

	async function forbidden(promise: Promise<unknown>) {
		try {
			await promise;
		} catch (err) {
			if (isHttpError(err)) return err.status;
			throw err;
		}
		return 'allowed';
	}

	it('refuses to confirm a receipt without payments.record', async () => {
		const staff = await makeStaff();
		const { id, paymentId } = await orderWithReceipt();
		const status = await forbidden(
			orderActions.confirmReceipt(
				post(
					`https://amoria.test/dashboard/orders/${id}?/confirmReceipt`,
					{ paymentId: String(paymentId) },
					{
						user: { id: staff } as never,
						permList: ['orders.view', 'orders.manage']
					},
					{ id: String(id) }
				)
			)
		);
		expect(status).toBe(403);
		const [p] = await db.select().from(payment);
		expect(p.status).toBe('initiated');
	});

	it('confirms a receipt for staff who may record payments', async () => {
		const staff = await makeStaff();
		const { id, paymentId } = await orderWithReceipt();
		const result = await orderActions.confirmReceipt(
			post(
				`https://amoria.test/dashboard/orders/${id}?/confirmReceipt`,
				{ paymentId: String(paymentId) },
				{
					user: { id: staff } as never,
					permList: ['payments.record']
				},
				{ id: String(id) }
			)
		);
		expect(result).toMatchObject({ done: expect.stringMatching(/confirmed/) });
		const [order] = await db.select().from(orders).where(eq(orders.id, id));
		expect(order.status).toBe('paid');
	});

	it('refuses to move an order along without orders.manage', async () => {
		const { id } = await orderWithReceipt();
		const status = await forbidden(
			orderActions.status(
				post(
					`https://amoria.test/dashboard/orders/${id}?/status`,
					{ to: 'cancelled' },
					{ permList: ['orders.view'] },
					{ id: String(id) }
				)
			)
		);
		expect(status).toBe(403);
		const [order] = await db.select().from(orders).where(eq(orders.id, id));
		expect(order.status).toBe('pending_payment');
	});

	it('reports a transition the table forbids as a failure, not a crash', async () => {
		const { id } = await orderWithReceipt();
		const result = (await orderActions.status(
			post(
				`https://amoria.test/dashboard/orders/${id}?/status`,
				{ to: 'completed' },
				{ isSuperAdmin: true },
				{ id: String(id) }
			)
		)) as { status: number; data: { error: string } };
		expect(result.status).toBe(409);
		expect(result.data.error).toMatch(/cannot become/);
	});
});
