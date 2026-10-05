import { beforeEach, describe, expect, it } from 'vitest';
import { Bag, MAX_LINES } from './bag.svelte';

const product = (id: number, overrides: Partial<{ price: number; stockQty: number }> = {}) => ({
	id,
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
		expect(bag.qtyOf(1)).toBe(2);
	});

	it('never goes past the stock, or 20 of one item', () => {
		const scarce = product(1, { stockQty: 2 });
		const plenty = product(2, { stockQty: 500 });
		const bag = new Bag(() => [scarce, plenty]);
		for (let i = 0; i < 5; i++) bag.add(scarce);
		bag.set(plenty, 999);
		expect(bag.qtyOf(1)).toBe(2);
		expect(bag.qtyOf(2)).toBe(20);
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
		expect(bag.items.map((i) => i.productId)).toEqual([2]);
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
		expect(second.qtyOf(7)).toBe(2);
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
				{ productId: 4, qty: 2 }
			])
		);
		bag.restore();
		expect(bag.lines).toEqual([{ productId: 4, qty: 2 }]);
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
});
