import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { attempt } from '$lib/server/attempt';
import { DESCRIPTIONS } from '$lib/server/permissions';
import {
	allPermissions,
	deleteRole,
	getRole,
	setRolePermissions,
	updateRole
} from '$lib/server/services/staff';
import { permissionPick, roleEdit } from '$lib/schemas/staff';

function roleId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Role not found');
	return id;
}

export const load = async ({ params, locals }) => {
	const role = await getRole(roleId(params));
	if (!role) error(404, 'Role not found');
	const permissions = await allPermissions();
	return {
		role,
		permissions: permissions.map((p) => ({
			...p,
			description: DESCRIPTIONS[p.name] ?? p.description
		})),
		canDelete: locals.isSuperAdmin && !role.isAdmin && role.members.length === 0,
		editForm: await superValidate(
			{ name: role.name, description: role.description ?? '', isActive: role.isActive },
			zod4(roleEdit),
			{ errors: false }
		)
	};
};

export const actions = {
	edit: async (event) => {
		const form = await superValidate(event.request, zod4(roleEdit));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);
		}
		try {
			await updateRole(event, roleId(event.params), form.data);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Saved' });
	},

	permissions: async (event) => {
		const form = await superValidate(event.request, zod4(permissionPick));
		if (!form.valid) return fail(400, { error: 'Reload the page and try again.' });
		return attempt(
			() => setRolePermissions(event, roleId(event.params), form.data.permissionIds),
			'Saved: everyone with this role has these permissions now'
		);
	},

	delete: async (event) => {
		requireSuperAdmin(event.locals);
		try {
			await deleteRole(event, roleId(event.params));
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
		redirect(303, '/dashboard/admin/roles');
	}
};
