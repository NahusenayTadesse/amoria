import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { contentCrud } from '@nahu/admin-kit/server/crud';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { course, courseIntake, registration } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { courseAdd, courseEdit } from '$lib/schemas/school';
import { slugify } from '$lib/slug';

/**
 * The décor school's courses (§10 School): the kit's `contentCrud`. What the form must never
 * decide is done here — the storefront link is made from the name when left empty, and empty
 * optional text is stored as null so the pages can tell "not filled in" from a blank.
 */
const crud = contentCrud({
	table: course,
	label: 'Course',
	addSchema: courseAdd,
	editSchema: courseEdit,
	uniqueField: 'slug',
	audit: 'course',
	listFields: ['curriculum', 'curriculumAm'],
	transform: async (values) => {
		const row = { ...values };
		row.slug = row.slug || slugify(row.title);
		if (!row.slug)
			throw new WriteRefused(
				'slug',
				'Give it a link name in Latin letters, e.g. flower-arch-basics'
			);
		for (const key of ['titleAm', 'summary', 'summaryAm', 'durationText'] as const) {
			row[key] = row[key] || null;
		}
		// Left empty: the course runs the default 20 days, and the builder asks for a class size.
		row.durationDays = row.durationDays ?? null;
		row.maxStudents = row.maxStudents ?? null;
		return row;
	}
});

export const load = async () => {
	const page = await crud.load();
	const ids = (page.rows as { id: number }[]).map((row) => row.id);

	// How many intakes are open and upcoming, and how many students hold a seat, per course.
	const [intakes, students] = ids.length
		? await Promise.all([
				db
					.select({ courseId: courseIntake.courseId, n: count() })
					.from(courseIntake)
					.where(
						and(
							inArray(courseIntake.courseId, ids),
							eq(courseIntake.status, 'open'),
							gte(courseIntake.startDate, localToday()),
							notDeleted(courseIntake)
						)
					)
					.groupBy(courseIntake.courseId),
				db
					.select({ courseId: courseIntake.courseId, n: count() })
					.from(registration)
					.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
					.where(and(inArray(courseIntake.courseId, ids), eq(registration.status, 'confirmed')))
					.groupBy(courseIntake.courseId)
			])
		: [[], []];
	const intakeCount = new Map(intakes.map((row) => [row.courseId, Number(row.n)]));
	const studentCount = new Map(students.map((row) => [row.courseId, Number(row.n)]));

	return {
		...page,
		rows: (page.rows as (typeof course.$inferSelect & { status: boolean })[]).map((row) => ({
			...row,
			// The edit dialog's boxes take one item per line.
			curriculum: asLines(row.curriculum),
			curriculumAm: asLines(row.curriculumAm),
			openIntakes: intakeCount.get(row.id) ?? 0,
			confirmedStudents: studentCount.get(row.id) ?? 0
		}))
	};
};

function asLines(value: unknown): string {
	return Array.isArray(value) ? value.join('\n') : '';
}

export const actions = invalidating(['catalog'], crud.actions);
