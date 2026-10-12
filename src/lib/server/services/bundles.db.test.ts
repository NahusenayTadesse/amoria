import { beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { orderItem, orders, product } from '$lib/server/db/schema';
import { guest, makeBundle, makeProduct, resetDb, stockOf } from '$lib/server/testing/db';
import { giftProducts } from './catalog';
import { createFromCart, expireHolds, type CartLine } from './orders';

beforeEach(resetDb);

function place(lines: CartLine[]) {
	return createFromCart({
		lines,
		contact: guest(),
		fulfilment: { type: 'pickup' },
		notes: null,
		sourceId: null
	});
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

describe('bundles on the shop', () => {
	it('lists a bundle priced off its gifts, counted by its scarcest gift', async () => {
		const rose = await makeProduct({ name: 'Rose', price: 1000, stockQty: 9 });
		const candle = await makeProduct({ name: 'Candle', price: 500, stockQty: 3 });
		await makeBundle(
			[
				{ productId: rose, qty: 2 },
				{ productId: candle, qty: 1 }
			],
			{ name: 'Valentine box', discountPercent: 10 }
		);

		const listed = (await giftProducts()).find((item) => item.kind === 'bundle')!;
		expect(listed.name).toBe('Valentine box');
		expect(listed.bundle!.fullPrice).toBe(2500);
		expect(listed.price).toBe(2250);
		// 9 roses make 4 boxes, but 3 candles make only 3.
		expect(listed.stockQty).toBe(3);
		expect(listed.key).toBe(`b${listed.id}`);
	});

	it('hides a bundle whose gift is switched off, rather than selling it short', async () => {
		const rose = await makeProduct({ price: 1000 });
		const candle = await makeProduct({ price: 500 });
		await makeBundle([
			{ productId: rose, qty: 1 },
			{ productId: candle, qty: 1 }
		]);
		await db.update(product).set({ isActive: false }).where(eq(product.id, candle));

		expect((await giftProducts()).some((item) => item.kind === 'bundle')).toBe(false);
	});

	it('sells a gift that is not on the shop by itself inside a bundle', async () => {
		const ribbon = await makeProduct({ price: 50, publishedAt: null });
		await makeBundle([{ productId: ribbon, qty: 1 }]);
		expect((await giftProducts()).map((item) => item.kind)).toEqual(['bundle']);
	});
});

describe('checking out a bundle', () => {
	it('stores one row per gift with its share of the discounted price, and takes each from stock', async () => {
		const rose = await makeProduct({ name: 'Rose', price: 1000, stockQty: 10 });
		const candle = await makeProduct({ name: 'Candle', price: 333.33, stockQty: 10 });
		const box = await makeBundle(
			[
				{ productId: rose, qty: 2 },
				{ productId: candle, qty: 1 }
			],
			{ name: 'Valentine box', discountPercent: 15 }
		);

		const placed = await place([
			{ bundleId: box, qty: 2 },
			{ productId: rose, qty: 1 }
		]);

		// (2 × 1000 + 333.33) × 0.85 = 1983.33 a box; two boxes and a rose.
		const [order] = await db.select().from(orders).where(eq(orders.id, placed.id));
		expect(order.subtotal).toBe(1983.33 * 2 + 1000);

		const rows = await db
			.select()
			.from(orderItem)
			.where(eq(orderItem.orderId, placed.id))
			.orderBy(asc(orderItem.id));
		const inBox = rows.filter((row) => row.bundleId === box);
		expect(inBox.map((row) => [row.nameSnapshot, row.qty, row.bundleQty])).toEqual([
			['Rose', 4, 2],
			['Candle', 2, 2]
		]);
		expect(inBox.every((row) => row.bundleName === 'Valentine box')).toBe(true);
		// The shares add up to exactly what the boxes cost.
		expect(inBox.reduce((cents, row) => cents + Math.round(row.lineTotal * 100), 0)).toBe(
			198333 * 2
		);

		// 4 roses in boxes and 1 by itself; 2 candles.
		expect(await stockOf(rose)).toBe(5);
		expect(await stockOf(candle)).toBe(8);
	});

	it('names the bundle, in whole bundles, when a gift in it runs short', async () => {
		const rose = await makeProduct({ name: 'Rose', price: 1000, stockQty: 5 });
		const box = await makeBundle([{ productId: rose, qty: 2 }], { name: 'Rose pair' });

		const refused = await refusal(place([{ bundleId: box, qty: 3 }]));
		expect(refused.message).toBe('Only 2 of Rose pair left. Lower the quantity and try again.');
		expect(await stockOf(rose)).toBe(5);
	});

	it('refuses a bundle that is no longer on sale', async () => {
		const rose = await makeProduct({ price: 1000 });
		const box = await makeBundle([{ productId: rose, qty: 1 }], { publishedAt: null });
		const refused = await refusal(place([{ bundleId: box, qty: 1 }]));
		expect(refused.message).toMatch(/no longer/i);
		expect(await stockOf(rose)).toBe(10);
	});

	it('gives every gift back when the hold runs out', async () => {
		const rose = await makeProduct({ price: 1000, stockQty: 6 });
		const candle = await makeProduct({ price: 500, stockQty: 6 });
		const box = await makeBundle([
			{ productId: rose, qty: 2 },
			{ productId: candle, qty: 1 }
		]);
		const placed = await place([{ bundleId: box, qty: 2 }]);
		await db
			.update(orders)
			.set({ holdExpiresAt: new Date(Date.now() - 60_000) })
			.where(eq(orders.id, placed.id));

		expect(await expireHolds()).toBe(1);
		expect(await stockOf(rose)).toBe(6);
		expect(await stockOf(candle)).toBe(6);
	});
});
