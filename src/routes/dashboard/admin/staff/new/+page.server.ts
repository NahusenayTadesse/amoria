import { redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { createStaff, roleChoices } from '$lib/server/services/staff';
import { staffAdd } from '$lib/schemas/staff';

export const load = async () => ({
	form: await superValidate(zod4(staffAdd)),
	roles: await roleChoices()
});

export const actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(staffAdd));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);
		}
		let id: string;
		try {
			id = await createStaff(event, form.data);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/dashboard/admin/staff/${id}`);
	}
};
