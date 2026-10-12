import { describe, expect, it } from 'vitest';
import {
	activeCount,
	applyFilter,
	EMPTY_FILTER,
	facetCounts,
	fromFields,
	readFilter,
	syncPrice,
	toFields,
	writeFilter,
	type FilterItem
} from './shopFilter';

const item = (over: Partial<FilterItem> & { name: string }): FilterItem => ({
	kind: 'product',
	nameAm: null,
	description: null,
	descriptionAm: null,
	price: 100,
	stockQty: 5,
	categoryId: 1,
	publishedAt: '2026-10-01T00:00:00.000Z',
	bundle: null,
	...over
});

const rose = item({ name: 'Red rose bouquet', price: 1450, categoryId: 1 });
const balloon = item({ name: 'Balloon bundle', price: 600, categoryId: 2, stockQty: 0 });
const valentine = item({
	kind: 'bundle',
	name: 'Valentine box',
	price: 3000,
	categoryId: 1,
	publishedAt: '2026-10-05T00:00:00.000Z',
	bundle: {
		discountPercent: 10,
		items: [{ name: 'Chocolate gift box', nameAm: null }],
		custom: null
	}
});
const basket = item({
	kind: 'bundle',
	name: 'Build your basket',
	price: 900,
	categoryId: null,
	bundle: { discountPercent: 10, items: [], custom: {} }
});
const all = [rose, balloon, valentine, basket];

describe('the shop filter in the URL', () => {
	it('reads what it wrote, and leaves defaults out', () => {
		const filter = {
			...EMPTY_FILTER,
			q: 'roses',
			types: ['bundle' as const, 'custom' as const],
			cats: ['flowers', 'balloons'],
			min: 500,
			max: 2000,
			inStock: true,
			onSale: true,
			sort: 'price_asc' as const
		};
		const query = writeFilter(filter, new URLSearchParams('bag=1'));
		expect(query).toBe(
			'?bag=1&q=roses&type=bundle%2Ccustom&cat=flowers%2Cballoons&min=500&max=2000&stock=1&sale=1&sort=price_asc'
		);
		expect(readFilter(new URLSearchParams(query))).toEqual(filter);
		expect(writeFilter(EMPTY_FILTER)).toBe('');
		expect(activeCount(filter)).toBe(8);
	});

	it('ignores what it cannot read', () => {
		expect(readFilter(new URLSearchParams('type=x,gift&min=-3&max=abc&sort=cheap'))).toEqual({
			...EMPTY_FILTER,
			types: ['gift']
		});
	});
});

describe('filtering and sorting', () => {
	it('narrows by type, price, stock, sale and words, in either name or what is inside', () => {
		const run = (over: Partial<typeof EMPTY_FILTER>, categories: number[] = []) =>
			applyFilter(all, { ...EMPTY_FILTER, ...over }, categories).map((i) => i.name);
		expect(run({ types: ['custom'] })).toEqual(['Build your basket']);
		expect(run({ min: 500, max: 1500 })).toEqual([
			'Red rose bouquet',
			'Balloon bundle',
			'Build your basket'
		]);
		expect(run({ inStock: true })).not.toContain('Balloon bundle');
		expect(run({ onSale: true })).toEqual(['Valentine box', 'Build your basket']);
		expect(run({ q: 'chocolate' })).toEqual(['Valentine box']);
		expect(run({}, [1])).toEqual(['Red rose bouquet', 'Valentine box']);
		expect(run({}, [1, 2])).toEqual(['Red rose bouquet', 'Balloon bundle', 'Valentine box']);
		expect(run({ sort: 'price_desc' })[0]).toBe('Valentine box');
		expect(run({ sort: 'newest' })[0]).toBe('Valentine box');
	});

	it('counts each choice over everything the other choices let through', () => {
		const facets = facetCounts(all, { ...EMPTY_FILTER, types: ['bundle'] }, []);
		// Ticking "bundles" does not zero the other types.
		expect(facets.types).toEqual({ gift: 2, bundle: 1, custom: 1 });
		expect(facets.categories.get(1)).toBe(1);
		expect(facets.allCategories).toBe(1);
		expect(facets.onSale).toBe(1);
	});
});

describe('the sidebar fields', () => {
	const ids: Record<string, number> = { flowers: 1, balloons: 2 };
	const slugs = Object.fromEntries(Object.entries(ids).map(([s, i]) => [i, s]));

	it('round-trip a filter, categories by id', () => {
		const filter = { ...EMPTY_FILTER, cats: ['balloons'], min: 500, max: 1000, inStock: true };
		const fields = toFields(filter, (s) => ids[s]);
		expect(fields.cats).toEqual([2]);
		expect(fields.price).toBe('1');
		expect(fromFields(fields, (i) => slugs[i])).toEqual(filter);
	});

	it('fill the boxes from a quick range, and tick the range the boxes match', () => {
		const start = toFields(EMPTY_FILTER, () => undefined);
		const picked = syncPrice(start, { ...start, price: '3' });
		expect([picked.min, picked.max]).toEqual([2000, null]);
		const typed = syncPrice(picked, { ...picked, min: '500', max: '1000' });
		expect(typed.price).toBe('1');
		const other = syncPrice(typed, { ...typed, max: '1200' });
		expect(other.price).toBe('');
		// Nothing to follow: the same object back.
		expect(syncPrice(other, other)).toBe(other);
	});
});
