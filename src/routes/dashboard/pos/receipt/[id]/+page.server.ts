import { error } from '@sveltejs/kit';
import { receiptView } from '$lib/server/services/inventory/pos';

/** A till receipt (or a refund slip), for the 80 mm printer or the customer's phone. */
export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Receipt not found');
	const view = await receiptView(id);
	if (!view) error(404, 'Receipt not found');
	return view;
};
