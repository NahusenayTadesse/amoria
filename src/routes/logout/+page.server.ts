import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

/** A POST, never a GET: a link prefetcher must not be able to sign anyone out. */
export const actions = {
	default: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
		redirect(303, '/login');
	}
};

export const load = () => redirect(302, '/dashboard');
