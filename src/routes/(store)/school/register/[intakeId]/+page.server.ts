import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';
import { classCourseSlug } from '$lib/server/services/school';

/**
 * The old one-class registration link (shared before classes had shifts): sends the guest to the
 * course's registration page with that class already chosen, or to the school if it is gone.
 */
export const load = async ({ params }) => {
	const id = Number(params.intakeId);
	const slug = Number.isInteger(id) && id > 0 ? await classCourseSlug(id) : null;
	redirect(
		308,
		localizeHref(slug ? `/school/${encodeURIComponent(slug)}/register?class=${id}` : '/school')
	);
};
