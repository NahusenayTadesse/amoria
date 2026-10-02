import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localToday } from '@nahu/admin-kit/time';
import { requisitionHeader } from '$lib/schemas/inventory';
import { locationOptions, quoteOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { saveRequisitionHeader } from '$lib/server/services/inventory/requisitions';

export const load = async ({ locals }) => ({
	locations: await locationOptions(),
	quotes: await quoteOptions(),
	form: await superValidate(
		{ requestDate: localToday(), requester: locals.user?.name ?? '' },
		zod4(requisitionHeader)
	)
});

export const actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(requisitionHeader));
		if (!form.valid) return fail(400, { form });
		let id: number;
		try {
			id = await saveRequisitionHeader(
				{
					header: {
						...form.data,
						quoteId: form.data.quoteId ?? null,
						neededBy: form.data.neededBy || null,
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
		redirect(303, `/dashboard/requisitions/${id}`);
	}
};
