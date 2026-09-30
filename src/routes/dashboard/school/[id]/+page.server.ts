import { error, fail } from '@sveltejs/kit';
import { and, count, eq, inArray } from 'drizzle-orm';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import { course, courseImage, courseIntake, registration } from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import { imageAdd, imageEdit } from '$lib/schemas/catalog';
import { intakeAdd, intakeEdit } from '$lib/schemas/school';
import { seatsTaken } from '$lib/server/services/school';

/** Photos: the kit's owner-scoped child CRUD — reads, writes and deletes only this course's rows. */
const images = childCrud({
	table: courseImage,
	ownerColumn: 'courseId',
	label: 'Photo',
	addSchema: imageAdd,
	editSchema: imageEdit,
	fileFields: ['fileName'],
	permission: 'school.manage',
	audit: 'course_image'
});

/**
 * Intakes: one run of the course, with its dates and a seat limit. The limit can never be set
 * below the seats already taken (paid or held), and the empty optional end date is stored as null.
 */
const intakes = childCrud({
	table: courseIntake,
	ownerColumn: 'courseId',
	label: 'Intake',
	addSchema: intakeAdd,
	editSchema: intakeEdit,
	permission: 'school.manage',
	audit: 'course_intake',
	transform: async (values, _event, before) => {
		const row = { ...values };
		row.endDate = row.endDate || null;
		row.scheduleText = row.scheduleText || null;

		if (before) {
			const taken = await seatsTaken(db, Number(before.id));
			if (Number(row.seatLimit) < taken) {
				throw new WriteRefused(
					'seatLimit',
					`${taken} seat${taken === 1 ? ' is' : 's are'} already taken or held. The limit cannot be lower.`
				);
			}
		}
		return row;
	}
});

function courseId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Course not found');
	return id;
}

export const load = async ({ params }) => {
	const id = courseId(params);
	const [row] = await db.select().from(course).where(eq(course.id, id));
	if (!row) error(404, 'Course not found');

	const [imagePage, intakePage] = await Promise.all([images.load(id), intakes.load(id)]);

	// Seats per intake, by what the registration is doing.
	const intakeIds = intakePage.rows.map((intake) => intake.id);
	const counts = intakeIds.length
		? await db
				.select({
					intakeId: registration.intakeId,
					status: registration.status,
					n: count()
				})
				.from(registration)
				.where(inArray(registration.intakeId, intakeIds))
				.groupBy(registration.intakeId, registration.status)
		: [];
	const stat = (intakeId: number, status: string) =>
		Number(counts.find((c) => c.intakeId === intakeId && c.status === status)?.n ?? 0);

	return {
		course: row,
		images: imagePage,
		intakes: {
			...intakePage,
			rows: (intakePage.rows as (typeof courseIntake.$inferSelect)[]).map((intake) => ({
				...intake,
				confirmed: stat(intake.id, 'confirmed'),
				awaiting: stat(intake.id, 'pending_payment'),
				needsSeat: stat(intake.id, 'paid_unfulfillable')
			}))
		}
	};
};

/** Photo and intake writes change what guests see, and which files `/media` may serve. */
const refreshSchool = () => {
	invalidate('catalog');
	invalidate('public-images');
};

export const actions = {
	addImage: async (event) => {
		const result = await images.actions.add(event, courseId(event.params));
		refreshSchool();
		return result;
	},
	editImage: async (event) => {
		const result = await images.actions.edit(event, courseId(event.params));
		refreshSchool();
		return result;
	},
	deleteImage: async (event) => {
		const result = await images.actions.delete(event, courseId(event.params));
		refreshSchool();
		return result;
	},

	addIntake: async (event) => {
		const result = await intakes.actions.add(event, courseId(event.params));
		refreshSchool();
		return result;
	},
	editIntake: async (event) => {
		const result = await intakes.actions.edit(event, courseId(event.params));
		refreshSchool();
		return result;
	},

	/** Only an intake nobody ever registered for can be removed; otherwise close or cancel it. */
	deleteIntake: async (event) => {
		requireSuperAdmin(event.locals);
		const form = await event.request.clone().formData();
		const id = Number(form.get('id'));
		const [{ n }] = await db
			.select({ n: count() })
			.from(registration)
			.where(and(eq(registration.intakeId, id)));
		if (n > 0) {
			return fail(409, {
				error: 'This intake has registrations. Close or cancel it instead of deleting it.'
			});
		}
		const result = await intakes.actions.delete(event, courseId(event.params));
		refreshSchool();
		return result;
	}
};
