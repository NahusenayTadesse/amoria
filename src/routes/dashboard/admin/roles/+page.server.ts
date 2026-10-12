import { redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { createRole, listRoles } from '$lib/server/services/staff';
import { roleAdd } from '$lib/schemas/staff';

export const load = async () => ({
	rows: await listRoles(),
	addForm: await superValidate(zod4(roleAdd))
});

export const actions = {
	/** A new role starts with no permissions; its page is where they are ticked. */
	add: async (event) => {
		const form = await superValidate(event.request, zod4(roleAdd));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);
		}
		let id: number;
		try {
			id = await createRole(event, form.data, []);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/dashboard/admin/roles/${id}`);
	}
};
