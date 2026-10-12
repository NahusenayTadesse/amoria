import { beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { orderItem, orders } from '$lib/server/db/schema';
import {
	guest,
	makeBundle,
	makeCategory,
	makeProduct,
	makeRule,
	resetDb,
	stockOf
} from '$lib/server/testing/db';
import { giftProducts } from './catalog';
import { createFromCart, type CartLine } from './orders';

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

async function refusal(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (err) {
		if (err instanceof WriteRefused) return err.message;
		throw err;
	}
	throw new Error('Expected a WriteRefused, but the call succeeded');
}

/**
 * A basket that holds up to 10 flowers (roses are filed under Flowers › Roses), exactly one
 * card, and at most 2 teddies; sold 10% off as a box customers fill.
 */
async function basketShop() {
	const flowers = await makeCategory({ name: 'Flowers' });
	const roses = await makeCategory({ name: 'Roses', parentId: flowers });
	const cards = await makeCategory({ name: 'Cards' });
	const toys = await makeCategory({ name: 'Toys' });
	const basket = await makeProduct({ name: 'Basket', price: 200, stockQty: 3 });
	const rose = await makeProduct({ name: 'Rose', price: 100, stockQty: 50, categoryId: roses });
	const tulip = await makeProduct({ name: 'Tulip', price: 80, stockQty: 50, categoryId: flowers });
	const card = await makeProduct({ name: 'Card', price: 50, stockQty: 20, categoryId: cards });
	const teddy = await makeProduct({ name: 'Teddy', price: 300, stockQty: 5, categoryId: toys });
	const robot = await makeProduct({ name: 'Robot', price: 400, stockQty: 5, categoryId: toys });
	await makeRule(basket, { categoryId: flowers, maxQty: 10 });
	await makeRule(basket, { categoryId: cards, minQty: 1, maxQty: 1 });
	await makeRule(basket, { productId: teddy, maxQty: 2 });
	const box = await makeBundle([], {
		name: 'Fill a basket',
		type: 'custom',
		containerId: basket,
		discountPercent: 10
	});
	return { basket, rose, tulip, card, teddy, robot, box };
}

describe('a box customers fill, on the shop', () => {
	it('offers the gifts its rules let in, from the cheapest box that meets the minimums', async () => {
		const { box, rose, tulip, card, teddy } = await basketShop();
		const listed = (await giftProducts()).find(
			(item) => item.kind === 'bundle' && item.id === box
		)!;
		const offer = listed.bundle!.custom!;

		expect(offer.container.name).toBe('Basket');
		// The robot is a toy, but only the teddy has a rule.
		expect(offer.choices.map((c) => c.productId).sort()).toEqual([rose, tulip, card, teddy].sort());
		// Basket 200 + the one card it needs, 50; less 10%.
		expect(listed.price).toBe(225);
		// As many as there are baskets.
		expect(listed.stockQty).toBe(3);
	});
});

describe('checking out a box customers filled', () => {
	it('stores the container and each gift with its share, and takes them all from stock', async () => {
		const { basket, rose, card, teddy, box } = await basketShop();
		const placed = await place([
			{
				bundleId: box,
				qty: 1,
				items: [
					{ productId: rose, qty: 6 },
					{ productId: card, qty: 1 },
					{ productId: teddy, qty: 2 }
				]
			}
		]);

		// (200 + 600 + 50 + 600) × 0.9
		const [order] = await db.select().from(orders).where(eq(orders.id, placed.id));
		expect(order.subtotal).toBe(1305);
		const rows = await db
			.select()
			.from(orderItem)
			.where(eq(orderItem.orderId, placed.id))
			.orderBy(asc(orderItem.id));
		expect(rows.map((r) => [r.productId, r.qty, r.bundleLine])).toEqual([
			[basket, 1, 1],
			[rose, 6, 1],
			[card, 1, 1],
			[teddy, 2, 1]
		]);
		expect(await stockOf(basket)).toBe(2);
		expect(await stockOf(rose)).toBe(44);
		expect(await stockOf(teddy)).toBe(3);
	});

	it('keeps two different boxes apart, and adds up the same box twice', async () => {
		const { rose, tulip, card, box } = await basketShop();
		const a = {
			bundleId: box,
			qty: 1,
			items: [
				{ productId: rose, qty: 3 },
				{ productId: card, qty: 1 }
			]
		};
		const b = {
			bundleId: box,
			qty: 1,
			items: [
				{ productId: tulip, qty: 3 },
				{ productId: card, qty: 1 }
			]
		};
		// The same contents in another order is the same box.
		const a2 = { ...a, items: [...a.items].reverse() };
		const placed = await place([a, b, a2]);

		const rows = await db.select().from(orderItem).where(eq(orderItem.orderId, placed.id));
		const lines = new Map<number, number>();
		for (const row of rows) lines.set(row.bundleLine!, row.bundleQty!);
		expect([...lines.values()].sort()).toEqual([1, 2]);
	});

	it('refuses a box with more than a rule allows, counting a gift under its parent category', async () => {
		const { rose, tulip, card, box } = await basketShop();
		const message = await refusal(
			place([
				{
					bundleId: box,
					qty: 1,
					items: [
						{ productId: rose, qty: 6 },
						{ productId: tulip, qty: 5 },
						{ productId: card, qty: 1 }
					]
				}
			])
		);
		expect(message).toBe('Fill a basket holds at most 10 Flowers. Take some out and try again.');
	});

	it('refuses a gift no rule lets in, and a box short of a minimum', async () => {
		const { rose, robot, box } = await basketShop();
		expect(
			await refusal(place([{ bundleId: box, qty: 1, items: [{ productId: robot, qty: 1 }] }]))
		).toBe('Robot cannot go in Fill a basket. Take it out and try again.');
		expect(
			await refusal(place([{ bundleId: box, qty: 1, items: [{ productId: rose, qty: 2 }] }]))
		).toBe('Fill a basket needs at least 1 Cards. Add more and try again.');
	});

	it('takes contents only for a box customers fill', async () => {
		const { rose, card, box } = await basketShop();
		const fixed = await makeBundle([{ productId: rose, qty: 1 }]);
		expect(await refusal(place([{ bundleId: box, qty: 1 }]))).toMatch(/no longer/);
		expect(
			await refusal(place([{ bundleId: fixed, qty: 1, items: [{ productId: card, qty: 1 }] }]))
		).toMatch(/no longer/);
	});
});

describe('a ready-made bundle in a container', () => {
	it('includes the container, and is hidden while its gifts break the rules', async () => {
		const { basket, rose, card } = await basketShop();
		const fits = await makeBundle(
			[
				{ productId: rose, qty: 3 },
				{ productId: card, qty: 1 }
			],
			{ containerId: basket }
		);
		const tooMany = await makeBundle(
			[
				{ productId: rose, qty: 11 },
				{ productId: card, qty: 1 }
			],
			{ containerId: basket }
		);

		const listed = await giftProducts();
		const shown = listed.find((item) => item.kind === 'bundle' && item.id === fits)!;
		// Basket 200 + 3 roses + a card.
		expect(shown.price).toBe(550);
		expect(shown.bundle!.items[0].name).toBe('Basket');
		expect(listed.some((item) => item.kind === 'bundle' && item.id === tooMany)).toBe(false);
	});
});
