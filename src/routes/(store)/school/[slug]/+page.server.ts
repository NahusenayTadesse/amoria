import { error } from '@sveltejs/kit';
import { schoolCourse } from '$lib/server/services/school';
import { getSettings, publicContact } from '$lib/server/services/settings';

/** One course (§10 `/school/[slug]`): photos, syllabus, and every intake open for registration. */
export const load = async ({ params }) => {
	const [course, settings] = await Promise.all([schoolCourse(params.slug), getSettings()]);
	if (!course) error(404, 'Course not found');
	return { course, contact: publicContact(settings) };
};
