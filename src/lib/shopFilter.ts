/**
 * The gift shop's filters: what the sidebar can narrow the list by, how that sits in the URL (so a
 * filtered shop can be shared and survives a reload), and the counts beside each choice.
 *
 * The shop is one cached list (`catalog.giftProducts`), filtered in the browser, so all of this is
 * plain functions with no server imports. The page renders the same result on the server, from
 * the same URL.
 */

export const SHOP_SORTS = ['featured', 'newest', 'price_asc', 'price_desc', 'name'] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

/** A single gift, a bundle staff made, or a box the customer fills. */
export const SHOP_TYPES = ['gift', 'bundle', 'custom'] as const;
export type ShopType = (typeof SHOP_TYPES)[number];

export type ShopFilter = {
	q: string;
	/** Empty means every type. */
	types: ShopType[];
	/** Category slugs; empty means every category. */
	cats: string[];
	min: number | null;
	max: number | null;
	inStock: boolean;
	onSale: boolean;
	sort: ShopSort;
};

/** What an item needs for filtering: a subset of `ShopProduct`. */
export type FilterItem = {
	kind: 'product' | 'bundle';
	name: string;
	nameAm: string | null;
	description: string | null;
	descriptionAm: string | null;
	price: number;
	stockQty: number;
	categoryId: number | null;
	publishedAt: string;
	bundle: {
		discountPercent: number;
		items: { name: string; nameAm: string | null }[];
		custom: unknown;
	} | null;
};

/** The quick price ranges, in birr; `null` is open-ended. */
export const PRICE_RANGES: [number | null, number | null][] = [
	[null, 500],
	[500, 1000],
	[1000, 2000],
	[2000, null]
];

export const EMPTY_FILTER: ShopFilter = {
	q: '',
	types: [],
	cats: [],
	min: null,
	max: null,
	inStock: false,
	onSale: false,
	sort: 'featured'
};

const amount = (value: string | null) => {
	if (value === null || value.trim() === '') return null;
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : null;
};

/** The filter a URL asks for. Anything unreadable is left at its default. */
export function readFilter(params: URLSearchParams): ShopFilter {
	const sort = params.get('sort') as ShopSort | null;
	const types = (params.get('type') ?? '')
		.split(',')
		.filter((t): t is ShopType => (SHOP_TYPES as readonly string[]).includes(t));
	return {
		q: (params.get('q') ?? '').slice(0, 80),
		types: [...new Set(types)],
		cats: [
			...new Set(
				(params.get('cat') ?? '')
					.split(',')
					.map((slug) => slug.trim())
					.filter((slug) => /^[a-z0-9-]{1,160}$/.test(slug))
			)
		],
		min: amount(params.get('min')),
		max: amount(params.get('max')),
		inStock: params.get('stock') === '1',
		onSale: params.get('sale') === '1',
		sort: sort && SHOP_SORTS.includes(sort) ? sort : 'featured'
	};
}

/**
 * The filter as URL parameters, defaults left out, on top of `base` (the URL's other parameters,
 * which are kept as they are).
 */
export function writeFilter(filter: ShopFilter, base = new URLSearchParams()): string {
	const params = new URLSearchParams(base);
	for (const key of ['q', 'type', 'cat', 'min', 'max', 'stock', 'sale', 'sort']) params.delete(key);
	if (filter.q.trim()) params.set('q', filter.q.trim());
	if (filter.types.length) params.set('type', filter.types.join(','));
	if (filter.cats.length) params.set('cat', filter.cats.join(','));
	if (filter.min !== null) params.set('min', String(filter.min));
	if (filter.max !== null) params.set('max', String(filter.max));
	if (filter.inStock) params.set('stock', '1');
	if (filter.onSale) params.set('sale', '1');
	if (filter.sort !== 'featured') params.set('sort', filter.sort);
	const query = params.toString();
	return query ? `?${query}` : '';
}

/** How many choices are narrowing the list (the sort is not one). */
export function activeCount(filter: ShopFilter): number {
	return (
		(filter.q.trim() ? 1 : 0) +
		filter.types.length +
		filter.cats.length +
		(filter.min !== null || filter.max !== null ? 1 : 0) +
		(filter.inStock ? 1 : 0) +
		(filter.onSale ? 1 : 0)
	);
}

export function typeOf(item: FilterItem): ShopType {
	if (!item.bundle) return 'gift';
	return item.bundle.custom ? 'custom' : 'bundle';
}

/** A bundle sold at a discount. */
export const isOnSale = (item: FilterItem) => (item.bundle?.discountPercent ?? 0) > 0;

/** Lower case, accents and spacing evened out, for matching what was typed. */
const fold = (text: string) =>
	text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Every word typed appears in the name, description or (for a bundle) what is in it, in either language. */
function matches(item: FilterItem, query: string) {
	const words = fold(query).split(' ').filter(Boolean);
	if (!words.length) return true;
	const text = fold(
		[
			item.name,
			item.nameAm,
			item.description,
			item.descriptionAm,
			...(item.bundle?.items.flatMap((part) => [part.name, part.nameAm]) ?? [])
		]
			.filter(Boolean)
			.join(' ')
	);
	return words.every((word) => text.includes(word));
}

type Facet = 'type' | 'category' | 'price' | 'stock' | 'sale';

/** The items that pass every choice but `skip`: what a facet's counts are taken over. */
function passes(item: FilterItem, filter: ShopFilter, categoryIds: number[], skip?: Facet) {
	if (
		skip !== 'category' &&
		categoryIds.length &&
		(item.categoryId === null || !categoryIds.includes(item.categoryId))
	)
		return false;
	if (skip !== 'type' && filter.types.length && !filter.types.includes(typeOf(item))) return false;
	if (skip !== 'price') {
		if (filter.min !== null && item.price < filter.min) return false;
		if (filter.max !== null && item.price > filter.max) return false;
	}
	if (skip !== 'stock' && filter.inStock && item.stockQty <= 0) return false;
	if (skip !== 'sale' && filter.onSale && !isOnSale(item)) return false;
	return matches(item, filter.q);
}

/** The list as it should show: filtered, then sorted. "Featured" keeps the catalogue's own order. */
export function applyFilter<T extends FilterItem>(
	items: T[],
	filter: ShopFilter,
	/** The ids of `filter.cats`, which only the caller can look up. */
	categoryIds: number[]
): T[] {
	const shown = items
		.map((item, index) => ({ item, index }))
		.filter(({ item }) => passes(item, filter, categoryIds));
	const by: Record<
		ShopSort,
		(a: { item: T; index: number }, b: { item: T; index: number }) => number
	> = {
		featured: (a, b) => a.index - b.index,
		newest: (a, b) => b.item.publishedAt.localeCompare(a.item.publishedAt) || a.index - b.index,
		price_asc: (a, b) => a.item.price - b.item.price || a.index - b.index,
		price_desc: (a, b) => b.item.price - a.item.price || a.index - b.index,
		name: (a, b) => a.item.name.localeCompare(b.item.name) || a.index - b.index
	};
	return shown.sort(by[filter.sort]).map(({ item }) => item);
}

/**
 * The count beside each choice: how many items it would show, given every other choice. So
 * ticking "Bundles" does not zero the other types' counts, as in any shop's sidebar.
 */
export function facetCounts(items: FilterItem[], filter: ShopFilter, categoryIds: number[]) {
	const count = (skip: Facet, test: (item: FilterItem) => boolean) =>
		items.filter((item) => passes(item, filter, categoryIds, skip) && test(item)).length;

	const categories = new Map<number, number>();
	let allCategories = 0;
	for (const item of items) {
		if (!passes(item, filter, categoryIds, 'category')) continue;
		allCategories++;
		if (item.categoryId !== null)
			categories.set(item.categoryId, (categories.get(item.categoryId) ?? 0) + 1);
	}

	return {
		types: Object.fromEntries(
			SHOP_TYPES.map((type) => [type, count('type', (item) => typeOf(item) === type)])
		) as Record<ShopType, number>,
		categories,
		allCategories,
		prices: PRICE_RANGES.map(([min, max]) =>
			count(
				'price',
				(item) => (min === null || item.price >= min) && (max === null || item.price <= max)
			)
		),
		inStock: count('stock', (item) => item.stockQty > 0),
		onSale: count('sale', isOnSale)
	};
}

/** The cheapest and dearest price on the shelf, for the price boxes' hints. */
export function priceBounds(items: FilterItem[]): { min: number; max: number } {
	if (!items.length) return { min: 0, max: 0 };
	const prices = items.map((item) => item.price);
	return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
}

/**
 * The filter as the sidebar's kit fields hold it (`InputComp` binds strings, numbers and
 * booleans in a store): categories by id for the checklist, and the quick price range chosen as
 * its index (`''` for none).
 */
export type FilterFields = {
	q: string;
	types: string[];
	cats: number[];
	price: string;
	min: number | string | null;
	max: number | string | null;
	inStock: boolean;
	onSale: boolean;
	sort: string;
};

const num = (value: unknown): number | null => {
	if (value === '' || value === null || value === undefined) return null;
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : null;
};

const rangeIndex = (min: number | null, max: number | null) =>
	PRICE_RANGES.findIndex(([a, b]) => a === min && b === max);

export function toFields(
	filter: ShopFilter,
	idOfSlug: (slug: string) => number | undefined
): FilterFields {
	const at = rangeIndex(filter.min, filter.max);
	return {
		q: filter.q,
		types: [...filter.types],
		cats: filter.cats.flatMap((slug) => idOfSlug(slug) ?? []),
		price: at < 0 ? '' : String(at),
		min: filter.min,
		max: filter.max,
		inStock: filter.inStock,
		onSale: filter.onSale,
		sort: filter.sort
	};
}

export function fromFields(
	fields: FilterFields,
	slugOfId: (id: number) => string | undefined
): ShopFilter {
	let min = num(fields.min);
	let max = num(fields.max);
	if (min !== null && max !== null && min > max) [min, max] = [max, min];
	return {
		q: fields.q ?? '',
		types: (fields.types ?? []).filter((t): t is ShopType =>
			(SHOP_TYPES as readonly string[]).includes(t)
		),
		cats: (fields.cats ?? []).flatMap((id) => slugOfId(Number(id)) ?? []),
		min,
		max,
		inStock: Boolean(fields.inStock),
		onSale: Boolean(fields.onSale),
		sort: (SHOP_SORTS as readonly string[]).includes(fields.sort)
			? (fields.sort as ShopSort)
			: 'featured'
	};
}

/**
 * Keeps the quick price ranges and the min/max boxes in step after an edit: picking a range
 * fills the boxes; typing in the boxes ticks the range they match, or none. Returns the fields
 * unchanged (the same object) when nothing needs to follow.
 */
export function syncPrice(before: FilterFields, after: FilterFields): FilterFields {
	if (after.price !== before.price && after.price !== '') {
		const [min, max] = PRICE_RANGES[Number(after.price)] ?? [null, null];
		if (num(after.min) !== min || num(after.max) !== max) return { ...after, min, max };
		return after;
	}
	if (num(after.min) !== num(before.min) || num(after.max) !== num(before.max)) {
		const at = rangeIndex(num(after.min), num(after.max));
		const price = at < 0 ? '' : String(at);
		if (price !== after.price) return { ...after, price };
	}
	return after;
}
