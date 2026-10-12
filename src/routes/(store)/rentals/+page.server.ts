import {
	marketFacets,
	PAGE_SIZE,
	searchListings,
	SORTS,
	type MarketFilters,
	type MarketSort
} from '$lib/server/services/marketplace';

/**
 * The rental marketplace (§5.12): everything approved renters rent out for events — venues, tents,
 * furniture, sound and light, décor — searchable and filtered by category, renter, pricing and
 * delivery. All filters live in the URL, so a filtered list can be shared and works without
 * JavaScript.
 */
export const load = async ({ url }) => {
	const q = url.searchParams;
	const pricing = q.get('pricing');
	const sort = q.get('sort');
	const filters: MarketFilters = {
		category: q.get('category') || undefined,
		renter: q.get('renter') || undefined,
		pricing: pricing === 'fixed' || pricing === 'quote' ? pricing : undefined,
		// `1` from a link, `true` from the kit's checkbox.
		delivery: q.get('delivery') === '1' || q.get('delivery') === 'true',
		q: q.get('q')?.trim() || undefined,
		sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as MarketSort) : 'featured',
		page: Math.max(1, Number(q.get('page')) || 1)
	};
	const [facets, found] = await Promise.all([marketFacets(), searchListings(filters)]);
	return {
		filters,
		facets,
		...found,
		pages: Math.max(1, Math.ceil(found.total / PAGE_SIZE))
	};
};
