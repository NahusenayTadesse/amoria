import { json } from '@sveltejs/kit';
import { currentShift, searchProducts } from '$lib/server/services/inventory/pos';

/**
 * The till's search box: an exact barcode or SKU first, then names, with what the shop floor holds.
 * Needs an open shift, since that says which location the till sells from.
 */
export const GET = async ({ url, locals }) => {
	const shift = await currentShift(locals.user!.id);
	if (!shift) return json({ results: [] });
	const results = await searchProducts(url.searchParams.get('q') ?? '', shift.locationId);
	return json({ results });
};
