import { describe, expect, it } from 'vitest';
import {
	boxCounts,
	boxFromPrice,
	boxParts,
	bundlePrice,
	bundleStock,
	checkBox,
	groupOrderItems,
	roomForOne,
	splitBundlePrice,
	type BoxOffer,
	type BoxRule
} from './bundle';

const part = (price: number, qty = 1, stockQty = 10) => ({ price, qty, stockQty });

describe('bundle pricing', () => {
	it('takes the discount off the gifts’ total, to the cent', () => {
		expect(bundlePrice([part(1000, 2), part(333.33)], 15)).toBe(1983.33);
		expect(bundlePrice([part(100)], 0)).toBe(100);
	});

	it('never takes off more than the most allowed', () => {
		expect(bundlePrice([part(100)], 150)).toBe(10);
	});

	it('counts whole bundles by the scarcest gift, and none with no contents', () => {
		expect(bundleStock([part(1, 2, 9), part(1, 1, 3)])).toBe(3);
		expect(bundleStock([part(1, 3, 2)])).toBe(0);
		expect(bundleStock([])).toBe(0);
	});

	it('splits the price in proportion, adding up exactly', () => {
		const shares = splitBundlePrice([part(1000, 2), part(333.33)], 1983.33);
		expect(shares.reduce((cents, s) => cents + Math.round(s * 100), 0)).toBe(198333);
		expect(shares[0]).toBeCloseTo(1700, 0);
	});
});

describe('groupOrderItems', () => {
	it('puts a bundle’s rows back under one line, leaving lone gifts as they are', () => {
		const row = (id: number, lineTotal: number, bundleId: number | null) => ({
			id,
			qty: 1,
			lineTotal,
			bundleId,
			bundleName: bundleId ? 'Box' : null,
			bundleQty: bundleId ? 2 : null
		});
		const lines = groupOrderItems([row(1, 100, null), row(2, 300.1, 7), row(3, 99.9, 7)]);
		expect(lines.map((l) => l.kind)).toEqual(['item', 'bundle']);
		const box = lines[1];
		expect(box.kind === 'bundle' && [box.name, box.qty, box.lineTotal, box.parts.length]).toEqual([
			'Box',
			2,
			400,
			2
		]);
	});
});

describe('container rules', () => {
	const rule = (id: number, over: Partial<BoxRule>): BoxRule => ({
		id,
		categoryId: null,
		productId: null,
		minQty: 0,
		maxQty: 10,
		name: `Rule ${id}`,
		nameAm: null,
		...over
	});
	// Flowers (1) › Roses (2); Toys (3).
	const rules = [
		rule(1, { categoryId: 1, maxQty: 10 }),
		rule(2, { categoryId: 3, maxQty: 3 }),
		rule(3, { productId: 30, maxQty: 1 }),
		rule(4, { productId: 40, minQty: 1, maxQty: 1 })
	];
	const rose = { productId: 20, categoryIds: [2, 1] };
	const teddy = { productId: 30, categoryIds: [3] };
	const card = { productId: 40, categoryIds: [9] };
	const lamp = { productId: 50, categoryIds: [8] };

	it('lets a gift in through its parent category, and counts it there', () => {
		expect(
			checkBox(rules, [
				{ ...rose, qty: 10 },
				{ ...card, qty: 1 }
			])
		).toEqual([]);
		expect(
			checkBox(rules, [
				{ ...rose, qty: 11 },
				{ ...card, qty: 1 }
			])
		).toEqual([{ kind: 'too_many', rule: rules[0], count: 11 }]);
	});

	it('counts a gift towards every rule that names it', () => {
		const counts = boxCounts(rules, [{ ...teddy, qty: 1 }]);
		expect(counts.get(2)).toBe(1);
		expect(counts.get(3)).toBe(1);
		// The teddy's own rule is full, though Toys has room.
		expect(roomForOne(rules, [{ ...teddy, qty: 1 }], teddy)).toBe(false);
	});

	it('refuses a gift no rule names, and a box short of a minimum', () => {
		expect(checkBox(rules, [{ ...lamp, qty: 1 }]).map((p) => p.kind)).toEqual([
			'not_allowed',
			'too_few'
		]);
		expect(roomForOne(rules, [], lamp)).toBe(false);
	});
});

describe('a box’s price', () => {
	const offer: BoxOffer = {
		container: { productId: 1, name: 'Basket', nameAm: null, price: 200 },
		rules: [
			{
				id: 1,
				categoryId: 5,
				productId: null,
				minQty: 2,
				maxQty: 10,
				name: 'Flowers',
				nameAm: null
			},
			{ id: 2, categoryId: 6, productId: null, minQty: 0, maxQty: 2, name: 'Toys', nameAm: null }
		],
		choices: [
			{
				productId: 10,
				name: 'Rose',
				nameAm: null,
				price: 100,
				stockQty: 9,
				image: null,
				categoryIds: [5]
			},
			{
				productId: 11,
				name: 'Daisy',
				nameAm: null,
				price: 40,
				stockQty: 9,
				image: null,
				categoryIds: [5]
			},
			{
				productId: 12,
				name: 'Teddy',
				nameAm: null,
				price: 300,
				stockQty: 9,
				image: null,
				categoryIds: [6]
			}
		]
	};

	it('is the container and the gifts chosen, less the discount', () => {
		expect(bundlePrice(boxParts(offer, [{ productId: 10, qty: 3 }]), 10)).toBe(450);
	});

	it('starts from the cheapest gifts that meet every minimum', () => {
		// Basket 200 + two daisies 80.
		expect(boxFromPrice(offer, 0)).toBe(280);
	});
});
