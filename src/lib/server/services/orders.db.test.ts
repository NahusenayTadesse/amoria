import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import {
	auditLog,
	customer,
	orderItem,
	orders,
	payment,
	stockMovement
} from '$lib/server/db/schema';
import {
	actorFor,
	guest,
	makeDeliveryArea,
	makeProduct,
	makeStaff,
	resetDb,
	setSettings,
	stockOf
} from '$lib/server/testing/db';
import { createFromCart, expireHolds, orderPayable, setOrderStatus } from './orders';

beforeEach(resetDb);

const pickup = { type: 'pickup' } as const;

/** Places a pickup order for the given lines, as checkout does. */
function place(
	lines: { productId: number; qty: number }[],
	extra: Partial<Parameters<typeof createFromCart>[0]> = {}
) {
	return createFromCart({
		lines,
		contact: guest(),
		fulfilment: pickup,
		notes: null,
		sourceId: null,
		...extra
	});
}

async function orderRow(id: number) {
	const [row] = await db.select().from(orders).where(eq(orders.id, id));
	return row;
}

/** Makes an order look as if its hold ran out a minute ago. */
async function expireHoldNow(id: number) {
	await db
		.update(orders)
		.set({ holdExpiresAt: new Date(Date.now() - 60_000) })
		.where(eq(orders.id, id));
}

async function refusal(promise: Promise<unknown>): Promise<WriteRefused> {
	try {
		await promise;
	} catch (err) {
		if (err instanceof WriteRefused) return err;
		throw err;
	}
	throw new Error('Expected a WriteRefused, but the call succeeded');
}

describe('createFromCart', () => {
	it('prices from the database, snapshots the lines, reserves stock and holds the order', async () => {
		await setSettings({ holdMinutes: 30 });
		const rose = await makeProduct({ name: 'Red rose bouquet', price: 1450, stockQty: 8 });
		const candle = await makeProduct({ name: 'Scented candle', price: 700, stockQty: 12 });

		const before = Date.now();
		const placed = await place([
			{ productId: rose, qty: 2 },
			{ productId: candle, qty: 1 }
		]);

		const order = await orderRow(placed.id);
		expect(order.subtotal).toBe(3600);
		expect(order.total).toBe(3600);
		expect(order.deliveryFee).toBe(0);
		expect(order.status).toBe('pending_payment');
		expect(order.ref).toBe(`AM-O-${String(placed.id).padStart(6, '0')}`);
		expect(order.publicToken).toHaveLength(22);
		expect(order.contactPhone).toBe('+251911234567');
		// Held for the configured 30 minutes.
		const holdMs = order.holdExpiresAt!.getTime() - before;
		expect(holdMs).toBeGreaterThan(29 * 60_000);
		expect(holdMs).toBeLessThan(31 * 60_000);

		const items = await db.select().from(orderItem).where(eq(orderItem.orderId, placed.id));
		expect(items.map((i) => [i.nameSnapshot, i.qty, i.unitPrice, i.lineTotal])).toEqual(
			expect.arrayContaining([
				['Red rose bouquet', 2, 1450, 2900],
				['Scented candle', 1, 700, 700]
			])
		);

		expect(await stockOf(rose)).toBe(6);
		expect(await stockOf(candle)).toBe(11);
		const moves = await db.select().from(stockMovement).where(eq(stockMovement.refId, placed.id));
		expect(moves).toHaveLength(2);
		expect(moves.every((m) => m.reason === 'sale' && m.refType === 'order' && m.delta < 0)).toBe(
			true
		);
	});

	it('merges repeated lines for the same product', async () => {
		const rose = await makeProduct({ price: 100, stockQty: 10 });
		const placed = await place([
			{ productId: rose, qty: 2 },
			{ productId: rose, qty: 3 }
		]);
		const items = await db.select().from(orderItem).where(eq(orderItem.orderId, placed.id));
		expect(items).toHaveLength(1);
		expect(items[0].qty).toBe(5);
		expect(await stockOf(rose)).toBe(5);
	});

	it('uses the price at checkout, not whatever the shop showed earlier', async () => {
		const rose = await makeProduct({ price: 100 });
		const placed = await place([{ productId: rose, qty: 1 }]);
		expect((await orderRow(placed.id)).total).toBe(100);
	});

	it('refuses an empty bag', async () => {
		const err = await refusal(place([]));
		expect(err.message).toMatch(/empty/i);
	});

	it('refuses more than 20 different products', async () => {
		const lines = Array.from({ length: 21 }, (_, i) => ({ productId: i + 1, qty: 1 }));
		const err = await refusal(place(lines));
		expect(err.message).toMatch(/too many/i);
	});

	it.each([
		['unpublished', { publishedAt: null }],
		['scheduled for later', { publishedAt: new Date(Date.now() + 86_400_000) }],
		['inactive', { isActive: false }],
		['deleted', { deletedAt: new Date() }]
	])('refuses a product that is %s', async (_label, overrides) => {
		const hidden = await makeProduct(overrides);
		const err = await refusal(place([{ productId: hidden, qty: 1 }]));
		expect(err.message).toMatch(/no longer sold/i);
		expect(await stockOf(hidden)).toBe(10);
	});

	it('refuses rental equipment in a gift order', async () => {
		const tent = await makeProduct({ kind: 'rental', price: null, dailyRate: 500 });
		await expect(place([{ productId: tent, qty: 1 }])).rejects.toBeInstanceOf(WriteRefused);
	});

	it('refuses a product that has sold out, and takes nothing from the rest of the bag', async () => {
		const gone = await makeProduct({ name: 'Coffee box', stockQty: 0 });
		const plenty = await makeProduct({ stockQty: 10 });
		const err = await refusal(
			place([
				{ productId: plenty, qty: 1 },
				{ productId: gone, qty: 1 }
			])
		);
		expect(err.message).toMatch(/Coffee box has just sold out/);
		// The whole order rolled back: the other line's stock is untouched and no order exists.
		expect(await stockOf(plenty)).toBe(10);
		expect(await db.select().from(orders)).toHaveLength(0);
	});

	it('says how many are left when the bag asks for more', async () => {
		const frame = await makeProduct({ name: 'Photo frame', stockQty: 3 });
		const err = await refusal(place([{ productId: frame, qty: 5 }]));
		expect(err.message).toMatch(/Only 3 of Photo frame left/);
		expect(await stockOf(frame)).toBe(3);
	});

	it('sells the last unit to exactly one of two customers checking out at once', async () => {
		const last = await makeProduct({ stockQty: 1 });
		const results = await Promise.allSettled([
			place([{ productId: last, qty: 1 }], { contact: guest({ phone: '+251911000001' }) }),
			place([{ productId: last, qty: 1 }], { contact: guest({ phone: '+251911000002' }) })
		]);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
		expect(failed.reason).toBeInstanceOf(WriteRefused);
		expect(await stockOf(last)).toBe(0);
	});

	describe('delivery', () => {
		it('charges the area fee below the free-delivery threshold', async () => {
			await setSettings({ freeDeliveryThreshold: 3000 });
			const area = await makeDeliveryArea({ name: 'Bole', fee: 250 });
			const gift = await makeProduct({ price: 1200 });
			const placed = await place([{ productId: gift, qty: 1 }], {
				fulfilment: { type: 'delivery', areaId: area, address: 'Near Edna Mall' }
			});
			const order = await orderRow(placed.id);
			expect(order).toMatchObject({
				fulfilment: 'delivery',
				deliveryAreaId: area,
				deliveryAreaName: 'Bole',
				deliveryAddress: 'Near Edna Mall',
				subtotal: 1200,
				deliveryFee: 250,
				total: 1450
			});
		});

		it('delivers free at the threshold', async () => {
			await setSettings({ freeDeliveryThreshold: 3000 });
			const area = await makeDeliveryArea({ fee: 250 });
			const gift = await makeProduct({ price: 1500 });
			const placed = await place([{ productId: gift, qty: 2 }], {
				fulfilment: { type: 'delivery', areaId: area, address: 'Somewhere' }
			});
			const order = await orderRow(placed.id);
			expect(order.deliveryFee).toBe(0);
			expect(order.total).toBe(3000);
		});

		it('treats a threshold of 0 as free delivery switched off', async () => {
			await setSettings({ freeDeliveryThreshold: 0 });
			const area = await makeDeliveryArea({ fee: 100 });
			const gift = await makeProduct({ price: 10_000 });
			const placed = await place([{ productId: gift, qty: 1 }], {
				fulfilment: { type: 'delivery', areaId: area, address: 'Somewhere' }
			});
			expect((await orderRow(placed.id)).deliveryFee).toBe(100);
		});

		it('refuses an area that is switched off, under the area field', async () => {
			const area = await makeDeliveryArea({ status: false });
			const gift = await makeProduct();
			const err = await refusal(
				place([{ productId: gift, qty: 1 }], {
					fulfilment: { type: 'delivery', areaId: area, address: 'x y z' }
				})
			);
			expect(err.field).toBe('deliveryAreaId');
			expect(await stockOf(gift)).toBe(10);
		});

		it('refuses delivery when the shop has turned it off', async () => {
			await setSettings({ deliveryEnabled: false });
			const area = await makeDeliveryArea();
			const gift = await makeProduct();
			await expect(
				place([{ productId: gift, qty: 1 }], {
					fulfilment: { type: 'delivery', areaId: area, address: 'x y z' }
				})
			).rejects.toBeInstanceOf(WriteRefused);
		});
	});

	describe('the customer row', () => {
		it('reuses the customer for the same phone and never renames them from checkout input', async () => {
			const gift = await makeProduct();
			await place([{ productId: gift, qty: 1 }], { contact: guest({ name: 'Hana Tesfaye' }) });
			await place([{ productId: gift, qty: 1 }], { contact: guest({ name: 'Somebody Else' }) });

			const rows = await db.select().from(customer);
			expect(rows).toHaveLength(1);
			expect(rows[0].name).toBe('Hana Tesfaye');

			// Each order still keeps what was typed for it.
			const names = (await db.select({ n: orders.contactName }).from(orders)).map((r) => r.n);
			expect(names.sort()).toEqual(['Hana Tesfaye', 'Somebody Else']);
		});
	});
});

describe('expireHolds', () => {
	it('expires unpaid orders whose hold has run out and gives their stock back', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const placed = await place([{ productId: gift, qty: 2 }]);
		expect(await stockOf(gift)).toBe(3);

		await expireHoldNow(placed.id);
		expect(await expireHolds()).toBe(1);

		expect((await orderRow(placed.id)).status).toBe('expired');
		expect(await stockOf(gift)).toBe(5);
		const back = await db
			.select()
			.from(stockMovement)
			.where(and(eq(stockMovement.refId, placed.id), eq(stockMovement.reason, 'sale_cancel')));
		expect(back).toHaveLength(1);
		expect(back[0].delta).toBe(2);
	});

	it('leaves orders whose hold has not run out', async () => {
		const gift = await makeProduct();
		const placed = await place([{ productId: gift, qty: 1 }]);
		expect(await expireHolds()).toBe(0);
		expect((await orderRow(placed.id)).status).toBe('pending_payment');
	});

	it('leaves orders held for a receipt check (no hold time)', async () => {
		const gift = await makeProduct();
		const placed = await place([{ productId: gift, qty: 1 }]);
		await db.update(orders).set({ holdExpiresAt: null }).where(eq(orders.id, placed.id));
		expect(await expireHolds()).toBe(0);
		expect((await orderRow(placed.id)).status).toBe('pending_payment');
	});

	it('is safe to run twice', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const placed = await place([{ productId: gift, qty: 1 }]);
		await expireHoldNow(placed.id);
		await expireHolds();
		expect(await expireHolds()).toBe(0);
		expect(await stockOf(gift)).toBe(5);
	});
});

describe('orderPayable.onPaid', () => {
	/** A successful payment row for an order, as the pipeline would have written it. */
	async function paymentFor(orderId: number) {
		const [row] = await db
			.insert(payment)
			.values({
				txRef: `test-${orderId}-${Math.random()}`,
				provider: 'chapa',
				purpose: 'order',
				orderId,
				amount: 1,
				status: 'success'
			})
			.$returningId();
		const [p] = await db.select().from(payment).where(eq(payment.id, row.id));
		return p;
	}

	const pay = async (orderId: number) => {
		const p = await paymentFor(orderId);
		await db.transaction((tx) => orderPayable.onPaid(tx, orderId, p));
	};

	it('marks a waiting order paid and clears its hold', async () => {
		const gift = await makeProduct();
		const placed = await place([{ productId: gift, qty: 1 }]);
		await pay(placed.id);
		const order = await orderRow(placed.id);
		expect(order.status).toBe('paid');
		expect(order.paidAt).not.toBeNull();
		expect(order.holdExpiresAt).toBeNull();
	});

	it('takes the stock again for a late payment on an expired order', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const placed = await place([{ productId: gift, qty: 2 }]);
		await expireHoldNow(placed.id);
		await expireHolds();
		expect(await stockOf(gift)).toBe(5);

		await pay(placed.id);
		expect((await orderRow(placed.id)).status).toBe('paid');
		expect(await stockOf(gift)).toBe(3);
	});

	it('marks a late payment paid_unfulfillable when the stock has gone, and takes nothing', async () => {
		const scarce = await makeProduct({ stockQty: 1 });
		const plenty = await makeProduct({ stockQty: 10 });
		const placed = await place([
			{ productId: plenty, qty: 1 },
			{ productId: scarce, qty: 1 }
		]);
		await expireHoldNow(placed.id);
		await expireHolds();
		// Meanwhile someone else bought the last scarce one.
		await place([{ productId: scarce, qty: 1 }], { contact: guest({ phone: '+251911999999' }) });

		await pay(placed.id);
		expect((await orderRow(placed.id)).status).toBe('paid_unfulfillable');
		// All or nothing: the plentiful line was not taken again either.
		expect(await stockOf(plenty)).toBe(10);
	});

	it('changes nothing when an already-paid order is paid again', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const placed = await place([{ productId: gift, qty: 1 }]);
		await pay(placed.id);
		await pay(placed.id);
		expect((await orderRow(placed.id)).status).toBe('paid');
		expect(await stockOf(gift)).toBe(4);
	});
});

describe('setOrderStatus', () => {
	async function paidOrder(qty = 1, stockQty = 10) {
		const gift = await makeProduct({ stockQty });
		const placed = await place([{ productId: gift, qty }]);
		await db
			.update(orders)
			.set({ status: 'paid', holdExpiresAt: null })
			.where(eq(orders.id, placed.id));
		return { gift, id: placed.id };
	}

	it('moves an order along and records who did it', async () => {
		const staff = await makeStaff();
		const { id } = await paidOrder();
		await setOrderStatus(id, 'preparing', actorFor(staff));
		await setOrderStatus(id, 'ready', actorFor(staff));
		await setOrderStatus(id, 'completed', actorFor(staff), 'Collected by her sister');

		expect((await orderRow(id)).status).toBe('completed');
		const audit = await db
			.select()
			.from(auditLog)
			.where(eq(auditLog.recordId, String(id)));
		expect(audit).toHaveLength(3);
		expect(audit.every((a) => a.userId === staff && a.tableName === 'orders')).toBe(true);
		expect(audit[2].changes).toMatchObject({
			status: ['ready', 'completed'],
			note: 'Collected by her sister'
		});
	});

	it.each([
		['pending_payment', 'paid'],
		['pending_payment', 'completed'],
		['completed', 'cancelled'],
		['expired', 'paid'],
		['cancelled', 'preparing']
	] as const)('refuses %s → %s', async (from, to) => {
		const gift = await makeProduct();
		const placed = await place([{ productId: gift, qty: 1 }]);
		await db.update(orders).set({ status: from }).where(eq(orders.id, placed.id));
		await expect(setOrderStatus(placed.id, to, actorFor(null))).rejects.toBeInstanceOf(
			WriteRefused
		);
		expect((await orderRow(placed.id)).status).toBe(from);
	});

	it('puts the stock back when an unpaid order is cancelled', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const placed = await place([{ productId: gift, qty: 2 }]);
		await setOrderStatus(placed.id, 'cancelled', actorFor(null));
		expect(await stockOf(gift)).toBe(5);
		expect((await orderRow(placed.id)).holdExpiresAt).toBeNull();
	});

	it('puts the stock back when a paid order is cancelled', async () => {
		const { gift, id } = await paidOrder(3, 10);
		expect(await stockOf(gift)).toBe(7);
		await setOrderStatus(id, 'cancelled', actorFor(null));
		expect(await stockOf(gift)).toBe(10);
	});

	it('does not put stock back for a paid_unfulfillable order (none was taken)', async () => {
		const gift = await makeProduct({ stockQty: 5 });
		const placed = await place([{ productId: gift, qty: 1 }]);
		await expireHoldNow(placed.id);
		await expireHolds();
		await db.update(orders).set({ status: 'paid_unfulfillable' }).where(eq(orders.id, placed.id));
		await setOrderStatus(placed.id, 'cancelled', actorFor(null));
		expect(await stockOf(gift)).toBe(5);
	});

	it('takes stock again when a paid_unfulfillable order is rebooked, or refuses if still short', async () => {
		const gift = await makeProduct({ stockQty: 1 });
		const placed = await place([{ productId: gift, qty: 1 }]);
		await expireHoldNow(placed.id);
		await expireHolds();
		await place([{ productId: gift, qty: 1 }], { contact: guest({ phone: '+251911888888' }) });
		await db.update(orders).set({ status: 'paid_unfulfillable' }).where(eq(orders.id, placed.id));

		await expect(setOrderStatus(placed.id, 'preparing', actorFor(null))).rejects.toThrow(
			/Still not enough stock/
		);
		expect((await orderRow(placed.id)).status).toBe('paid_unfulfillable');

		// A delivery arrives; now the rebooking goes through.
		await db
			.update((await import('$lib/server/db/schema')).product)
			.set({ stockQty: 4 })
			.where(eq((await import('$lib/server/db/schema')).product.id, gift));
		await setOrderStatus(placed.id, 'preparing', actorFor(null));
		expect((await orderRow(placed.id)).status).toBe('preparing');
		expect(await stockOf(gift)).toBe(3);
	});

	it('refuses an order that does not exist', async () => {
		await expect(setOrderStatus(999_999, 'cancelled', actorFor(null))).rejects.toThrow(
			/does not exist/
		);
	});
});
