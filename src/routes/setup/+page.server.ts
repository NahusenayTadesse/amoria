import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { seedPermissions } from '$lib/server/permissions';
import { setupSchema } from '$lib/schemas/auth';

/**
 * Creates the first admin, once. After an admin exists this page is a 404 — staff are then created
 * from the dashboard. Public sign-up stays closed (`hooks.server.ts`); this runs `signUpEmail` on
 * the server, which does not pass through that route.
 */
async function adminExists() {
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin')).limit(1);
	return Boolean(row);
}

export const load = async () => {
	if (await adminExists()) error(404, 'Not found');
	return { form: await superValidate(zod4(setupSchema)) };
};

export const actions = {
	default: async ({ request }) => {
		if (await adminExists()) error(404, 'Not found');
		const form = await superValidate(request, zod4(setupSchema));
		if (!form.valid)
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);

		const { adminRoleId } = await seedPermissions();
		try {
			const created = await auth.api.signUpEmail({
				body: { name: form.data.name, email: form.data.email, password: form.data.password },
				headers: request.headers
			});
			// `role` and `roleId` are `input: false`, so they are set here, never from the form.
			await db
				.update(user)
				.set({ role: 'admin', roleId: adminRoleId })
				.where(eq(user.id, created.user.id));
		} catch (err) {
			console.error('Setup: could not create the admin:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not create the account. Is that email already used?' },
				{ status: 400 }
			);
		}

		redirect(303, '/login');
	}
};
