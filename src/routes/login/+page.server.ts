import { redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { auth } from '$lib/server/auth';
import { isStaff } from '$lib/server/staff';
import { takeToken } from '$lib/server/rateLimit';
import { loginSchema } from '$lib/schemas/auth';

/** Staff sign-in (stock management's page). Customers have no accounts yet (§14). */
export const load = async ({ locals }) => {
	if (isStaff(locals.user)) redirect(302, '/dashboard');
	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions = {
	login: async ({ request, url, getClientAddress }) => {
		const form = await superValidate(request, zod4(loginSchema));
		if (!takeToken(`login:${getClientAddress()}`, { capacity: 8, perMinute: 4 })) {
			return message(
				form,
				{ type: 'error', text: 'Too many attempts. Wait a minute and try again.' },
				{ status: 429 }
			);
		}
		if (!form.valid)
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);

		try {
			await auth.api.signInEmail({
				body: { email: form.data.email, password: form.data.password },
				headers: request.headers
			});
		} catch {
			// The same words for an unknown email and a wrong password, so the form cannot be used to
			// find out which emails have accounts.
			return message(
				form,
				{ type: 'error', text: 'That email and password did not match.' },
				{ status: 401 }
			);
		}

		// Same-origin paths only: `//evil.com` and `/\evil.com` both start with a slash.
		const redirectTo = url.searchParams.get('redirectTo');
		redirect(303, redirectTo && /^\/(?![/\\])/.test(redirectTo) ? redirectTo : '/dashboard');
	}
};
