import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localToday } from '@nahu/admin-kit/time';
import { orderHeader } from '$lib/schemas/inventory';
import { locationOptions, supplierOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { saveOrderHeader } from '$lib/server/services/inventory/purchasing';
import { defaultPlace, places } from '$lib/server/services/inventory/ledger';
import { db } from '$lib/server/db';

export const load = async () => {
	const [locations, suppliers, shop] = await Promise.all([
		locationOptions(),
		supplierOptions(),
		db.transaction((tx) => places(tx)).then((list) => defaultPlace(list).id)
	]);
	return {
		locations,
		suppliers,
		form: await superValidate({ orderDate: localToday(), locationId: shop }, zod4(orderHeader))
	};
};

export const actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(orderHeader));
		if (!form.valid) return fail(400, { form });
		let id: number;
		try {
			id = await saveOrderHeader(
				{
					header: {
						...form.data,
						expectedDate: form.data.expectedDate || null,
						reference: form.data.reference || null,
						note: form.data.note || null
					}
				},
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/dashboard/purchasing/${id}`);
	}
};
