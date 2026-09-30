import { schoolCourses } from '$lib/server/services/school';
import { getSettings, publicContact } from '$lib/server/services/settings';

/** The décor school's front page (§10 `/school`): every course, each with its next open intake. */
export const load = async () => {
	const [courses, settings] = await Promise.all([schoolCourses(), getSettings()]);
	return { courses, contact: publicContact(settings) };
};
