import { redirect } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { currentRenter, renterActor } from '$lib/server/renterArea';
import { createListing, rentalCategories } from '$lib/server/services/renters';
import { listingSchema } from '$lib/schemas/renters';

/** A new rental. Saved, it opens its own page to add the photos. */
export const load = async ({ locals }) => {
	const renter = await currentRenter(locals);
	if (renter.status !== 'approved') redirect(303, '/renter/listings');
	return {
		form: await superValidate(zod4(listingSchema)),
		categories: await rentalCategories()
	};
};

export const actions = {
	default: async (event) => {
		const renter = await currentRenter(event.locals);
		const form = await superValidate(event.request, zod4(listingSchema));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);
		}
		let id: number;
		try {
			id = await createListing(renterActor(event), renter.id, form.data);
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) return setError(form, err.field as '', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/renter/listings/${id}?added=1`);
	}
};
