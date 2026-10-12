import { beforeEach, describe, expect, it } from 'vitest';
import { Bag, MAX_LINES } from './bag.svelte';

const product = (id: number, overrides: Partial<{ price: number; stockQty: number }> = {}) => ({
	kind: 'product' as const,
	id,
	key: `p${id}`,
	slug: `gift-${id}`,
	name: `Gift ${id}`,
	nameAm: null,
	price: 100,
	stockQty: 10,
	...overrides
});

beforeEach(() => localStorage.clear());

describe('Bag', () => {
	it('adds, counts and totals in birr', () => {
		const products = [product(1, { price: 1450 }), product(2, { price: 950.5 })];
		const bag = new Bag(() => products);
		bag.add(products[0]);
		bag.add(products[0]);
		bag.add(products[1]);
		expect(bag.count).toBe(3);
		expect(bag.total).toBe(3850.5);
		expect(bag.qtyOf('p1')).toBe(2);
	});

	it('never goes past the stock, or 20 of one item', () => {
		const scarce = product(1, { stockQty: 2 });
		const plenty = product(2, { stockQty: 500 });
		const bag = new Bag(() => [scarce, plenty]);
		for (let i = 0; i < 5; i++) bag.add(scarce);
		bag.set(plenty, 999);
		expect(bag.qtyOf('p1')).toBe(2);
		expect(bag.qtyOf('p2')).toBe(20);
	});

	it('removes a line when its quantity reaches zero', () => {
		const p = product(1);
		const bag = new Bag(() => [p]);
		bag.add(p);
		bag.set(p, 0);
		expect(bag.lines).toEqual([]);
		expect(bag.count).toBe(0);
	});

	it('holds at most 20 different products', () => {
		const products = Array.from({ length: MAX_LINES + 3 }, (_, i) => product(i + 1));
		const bag = new Bag(() => products);
		for (const p of products) bag.add(p);
		expect(bag.lines).toHaveLength(MAX_LINES);
	});

	it('drops lines whose product is no longer on sale from the items and the posted JSON', () => {
		let products = [product(1), product(2)];
		const bag = new Bag(() => products);
		bag.add(products[0]);
		bag.add(products[1]);
		products = [product(2)]; // product 1 was unpublished meanwhile
		expect(bag.items.map((i) => i.key)).toEqual(['p2']);
		expect(JSON.parse(bag.toJSON())).toEqual([{ productId: 2, qty: 1 }]);
	});

	it('posts only product ids and quantities — never prices', () => {
		const p = product(1, { price: 1450 });
		const bag = new Bag(() => [p]);
		bag.add(p);
		expect(JSON.parse(bag.toJSON())).toEqual([{ productId: 1, qty: 1 }]);
	});

	it('survives a reload through localStorage', () => {
		const p = product(7);
		const first = new Bag(() => [p]);
		first.add(p);
		first.add(p);

		const second = new Bag(() => [p]);
		second.restore();
		expect(second.qtyOf('p7')).toBe(2);
	});

	it('starts empty from a damaged saved bag instead of breaking the page', () => {
		localStorage.setItem('amoria-bag', '{not json');
		const bag = new Bag(() => []);
		bag.restore();
		expect(bag.lines).toEqual([]);

		localStorage.setItem(
			'amoria-bag',
			JSON.stringify([
				{ productId: 'x', qty: 1 },
				{ productId: 3, qty: -2 },
				{ key: 'b5', qty: 1 },
				{ productId: 4, qty: 2 }
			])
		);
		bag.restore();
		// A bag saved before bundles keyed lines by the gift's number alone; it still loads.
		expect(bag.lines).toEqual([
			{ key: 'b5', qty: 1 },
			{ key: 'p4', qty: 2 }
		]);
	});

	it('keeps a gift and a bundle with the same number apart, and posts each by its own id', () => {
		const gift = product(3, { price: 200 });
		const set = { ...product(3, { price: 900, stockQty: 4 }), kind: 'bundle' as const, key: 'b3' };
		const bag = new Bag(() => [gift, set]);
		bag.add(gift);
		bag.add(set);
		bag.add(set);
		expect(bag.qtyOf('p3')).toBe(1);
		expect(bag.qtyOf('b3')).toBe(2);
		expect(bag.total).toBe(2000);
		expect(JSON.parse(bag.toJSON())).toEqual([
			{ productId: 3, qty: 1 },
			{ bundleId: 3, qty: 2 }
		]);
	});

	it('empties itself, and the saved copy, after an order is placed', () => {
		const p = product(1);
		const bag = new Bag(() => [p]);
		bag.add(p);
		bag.clear();
		const reloaded = new Bag(() => [p]);
		reloaded.restore();
		expect(reloaded.count).toBe(0);
	});

	it('keeps each built box as its own line, priced from what is in it', () => {
		const offer = {
			container: { productId: 1, name: 'Basket', nameAm: null, price: 200 },
			rules: [
				{
					id: 1,
					categoryId: 5,
					productId: null,
					minQty: 0,
					maxQty: 4,
					name: 'Flowers',
					nameAm: null
				}
			],
			choices: [
				{
					productId: 10,
					name: 'Rose',
					nameAm: null,
					price: 100,
					stockQty: 6,
					image: null,
					categoryIds: [5]
				},
				{
					productId: 11,
					name: 'Daisy',
					nameAm: null,
					price: 50,
					stockQty: 6,
					image: null,
					categoryIds: [5]
				}
			]
		};
		const box = {
			...product(7, { price: 200, stockQty: 5 }),
			kind: 'bundle' as const,
			key: 'b7',
			bundle: { discountPercent: 10, custom: offer }
		};
		const bag = new Bag(() => [box]);

		bag.add(box); // A box cannot go in empty.
		expect(bag.lines).toEqual([]);

		bag.addBox(box, [{ productId: 10, qty: 2 }]);
		bag.addBox(box, [{ productId: 11, qty: 1 }]);
		bag.addBox(box, [{ productId: 10, qty: 2 }]); // the same box again
		expect(bag.items.map((i) => [i.qty, i.unitPrice])).toEqual([
			[2, 360],
			[1, 225]
		]);
		// Six roses make three boxes of two; stepping stops there.
		const first = bag.items[0];
		expect(first.max).toBe(3);
		bag.setLine(first.key, 9);
		expect(bag.items[0].qty).toBe(3);

		expect(JSON.parse(bag.toJSON())[1]).toEqual({
			bundleId: 7,
			qty: 1,
			items: [{ productId: 11, qty: 1 }]
		});

		// A saved box that no longer fits its container's rules drops out.
		bag.lines.push({ key: 'c7:10.5', of: 'b7', qty: 1, items: [{ productId: 10, qty: 5 }] });
		expect(bag.items).toHaveLength(2);
	});
});
