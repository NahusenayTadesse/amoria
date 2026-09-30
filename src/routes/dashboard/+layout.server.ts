import { redirect } from '@sveltejs/kit';
import { isStaff } from '$lib/server/staff';

/**
 * The dashboard is for staff only (§4.3 fix 2). Signed out goes to the login page and comes back;
 * signed in as anyone else goes to the shop, since there is no customer account page yet.
 */
export const load = ({ locals, url }) => {
	if (!locals.user)
		redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	if (!isStaff(locals.user)) redirect(302, '/shop');

	return {
		permList: locals.permList,
		isSuperAdmin: locals.isSuperAdmin,
		user: { id: locals.user.id, name: locals.user.name, email: locals.user.email }
	};
};
