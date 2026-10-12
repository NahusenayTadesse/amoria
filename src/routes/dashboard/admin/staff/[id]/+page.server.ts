import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localPhone } from '@nahu/admin-kit/phone';
import { requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { attempt } from '$lib/server/attempt';
import { ADMIN_ROLE, DESCRIPTIONS } from '$lib/server/permissions';
import {
	allPermissions,
	deleteStaff,
	getStaff,
	resetStaffPassword,
	roleChoices,
	setCustomPermissions,
	setStaffActive,
	updateStaff
} from '$lib/server/services/staff';
import { passwordReset, permissionPick, staffEdit } from '$lib/schemas/staff';

export const load = async ({ params, locals }) => {
	const person = await getStaff(params.id);
	if (!person) error(404, 'Staff member not found');

	const [permissions, roles] = await Promise.all([allPermissions(), roleChoices()]);
	const isSelf = person.id === locals.user?.id;
	const isAdmin = person.roleName === ADMIN_ROLE;

	return {
		person,
		isSelf,
		isAdmin,
		/** The same rules the service enforces, so the page offers only what will work. */
		canEdit: !isSelf && (!isAdmin || locals.isSuperAdmin),
		canDelete: !isSelf && locals.isSuperAdmin,
		permissions: permissions.map((p) => ({
			...p,
			description: DESCRIPTIONS[p.name] ?? p.description
		})),
		roles:
			roles.some((r) => r.value === person.roleId) || !person.roleId
				? roles
				: [...roles, { value: person.roleId, name: `${person.roleName} (switched off)` }],
		editForm: await superValidate(
			{
				name: person.name,
				email: person.email,
				phone: localPhone(person.phone) ?? '',
				roleId: person.roleId ?? undefined
			},
			zod4(staffEdit),
			{ errors: false }
		),
		passwordForm: await superValidate(zod4(passwordReset))
	};
};

const refused = (err: unknown) => {
	if (err instanceof WriteRefused) return err.message;
	throw err;
};

export const actions = {
	edit: async (event) => {
		const form = await superValidate(event.request, zod4(staffEdit));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);
		}
		try {
			await updateStaff(event, event.params.id, form.data);
		} catch (err) {
			return message(form, { type: 'error', text: refused(err) }, { status: 409 });
		}
		return message(form, { type: 'success', text: 'Saved' });
	},

	password: async (event) => {
		const form = await superValidate(event.request, zod4(passwordReset));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the password.' }, { status: 400 });
		}
		try {
			await resetStaffPassword(event, event.params.id, form.data.password);
		} catch (err) {
			return message(form, { type: 'error', text: refused(err) }, { status: 409 });
		}
		return message(form, {
			type: 'success',
			text: 'Password set. They were signed out everywhere and sign in with the new one.'
		});
	},

	permissions: async (event) => {
		const form = await superValidate(event.request, zod4(permissionPick));
		if (!form.valid) return fail(400, { error: 'Reload the page and try again.' });
		if (!form.data.permissionIds.length) {
			return fail(400, {
				error: 'Tick at least one, or use "Go back to the role’s permissions" instead.'
			});
		}
		return attempt(
			() => setCustomPermissions(event, event.params.id, form.data.permissionIds),
			'Saved: they now have their own permissions'
		);
	},

	useRole: (event) =>
		attempt(
			() => setCustomPermissions(event, event.params.id, []),
			'They now have their role’s permissions'
		),

	deactivate: (event) =>
		attempt(
			() => setStaffActive(event, event.params.id, false),
			'Switched off: they were signed out and cannot sign in'
		),

	activate: (event) =>
		attempt(
			() => setStaffActive(event, event.params.id, true),
			'Switched on: they can sign in again'
		),

	delete: async (event) => {
		requireSuperAdmin(event.locals);
		try {
			await deleteStaff(event, event.params.id);
		} catch (err) {
			return fail(409, { error: refused(err) });
		}
		redirect(303, '/dashboard/admin/staff');
	}
};
