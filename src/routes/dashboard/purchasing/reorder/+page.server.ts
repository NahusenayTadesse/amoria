import { fail, redirect } from '@sveltejs/kit';
import { locationOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt } from '$lib/server/attempt';
import { ordersFromReorder, reorderSuggestions } from '$lib/server/services/inventory/purchasing';

/**
 * What to buy: products at or under their reorder level, or that will run out before a delivery
 * could arrive. "Plan for" a location to use that location's own min and max instead.
 */
export const load = async ({ url }) => {
	const raw = Number(url.searchParams.get('location'));
	const locationId = Number.isInteger(raw) && raw > 0 ? raw : null;
	const [suggestions, locations] = await Promise.all([
		reorderSuggestions({ locationId }),
		locationOptions()
	]);
	return { suggestions, locations, locationId };
};

export const actions = {
	/** Ticked rows become one draft order per main supplier. */
	order: async (event) => {
		const data = await event.request.formData();
		const picks = data
			.getAll('pick')
			.map((id) => ({ productId: Number(id), quantity: Number(data.get(`qty_${id}`)) }))
			.filter((p) => Number.isInteger(p.productId) && p.quantity > 0);
		if (!picks.length) return fail(400, { error: 'Tick the products you want to order.' });

		let ids: number[] = [];
		const result = await attempt(async () => {
			ids = await ordersFromReorder(picks, actorOf(event));
		}, 'Draft orders made');
		if ('data' in result) return result;
		redirect(303, ids.length === 1 ? `/dashboard/purchasing/${ids[0]}` : '/dashboard/purchasing');
	}
};
