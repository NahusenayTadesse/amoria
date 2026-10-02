import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localToday } from '@nahu/admin-kit/time';
import { countOpen } from '$lib/schemas/inventory';
import { categoryOptions, locationOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { openCount } from '$lib/server/services/inventory/counts';

export const load = async () => ({
	locations: await locationOptions({ withQuarantine: true }),
	categories: await categoryOptions(),
	form: await superValidate({ countDate: localToday(), blind: true }, zod4(countOpen))
});

export const actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(countOpen));
		if (!form.valid) return fail(400, { form });
		let id: number;
		try {
			id = await openCount(
				{ ...form.data, categoryId: form.data.categoryId ?? null, note: form.data.note || null },
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/dashboard/stock/counts/${id}`);
	}
};
