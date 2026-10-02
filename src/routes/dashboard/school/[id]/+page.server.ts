import { error, fail } from '@sveltejs/kit';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { requirePermission, requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import {
	course,
	courseImage,
	courseIntake,
	registration,
	schoolShift
} from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import { imageAdd, imageEdit } from '$lib/schemas/catalog';
import { classBuilderSchema, intakeAdd, intakeEdit } from '$lib/schemas/school';
import { createClasses, sameClassExists, seatsTaken } from '$lib/server/services/school';
import { actorOf } from '$lib/server/paymentAdmin';
import { courseDays, lastDay } from '$lib/schoolPlan';

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
 * Classes (`course_intake`): one run of the course, in one shift, with a limit on students. The
 * limit can never be set below the seats already taken (paid or held). A last day left empty is
 * worked out from the course's length, and the same first day and shift cannot be added twice.
 */
const intakes = childCrud({
	table: courseIntake,
	ownerColumn: 'courseId',
	label: 'Intake',
	addSchema: intakeAdd,
	editSchema: intakeEdit,
	permission: 'school.manage',
	audit: 'course_intake',
	transform: async (values, event, before) => {
		const row = { ...values };
		const owner = courseId(event.params);
		row.scheduleText = row.scheduleText || null;
		row.shiftId = row.shiftId || null;
		if (!row.endDate) {
			const [c] = await db
				.select({ days: course.durationDays })
				.from(course)
				.where(eq(course.id, owner));
			row.endDate = lastDay(String(row.startDate), courseDays(c?.days));
		}
		if (
			await sameClassExists(
				owner,
				String(row.startDate),
				row.shiftId ? Number(row.shiftId) : null,
				before ? Number(before.id) : undefined
			)
		) {
			throw new WriteRefused(
				'startDate',
				'This course already has a class starting that day in that shift.'
			);
		}

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

	const [imagePage, intakePage, shifts] = await Promise.all([
		images.load(id),
		intakes.load(id),
		db
			.select({
				id: schoolShift.id,
				name: schoolShift.name,
				timeText: schoolShift.timeText,
				status: schoolShift.status
			})
			.from(schoolShift)
			.where(notDeleted(schoolShift))
			.orderBy(asc(schoolShift.sortOrder), asc(schoolShift.id))
	]);
	const shiftName = new Map(shifts.map((s) => [s.id, s.name]));

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
		/** Every shift, for the class form; the builder offers only those in use. */
		shifts,
		images: imagePage,
		intakes: {
			...intakePage,
			rows: (intakePage.rows as (typeof courseIntake.$inferSelect)[]).map((intake) => ({
				...intake,
				shiftName: intake.shiftId ? (shiftName.get(intake.shiftId) ?? '') : '',
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
	/**
	 * The class builder: the browser plans the classes from a date range, the course length and the
	 * chosen shifts (`$lib/schoolPlan`); the service creates them, skipping any that already exist.
	 */
	buildClasses: async (event) => {
		requirePermission(event.locals, 'school.manage');
		const id = courseId(event.params);
		const parsed = classBuilderSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Check the classes.' });
		}
		try {
			const { created, skipped } = await createClasses(id, parsed.data.classes, actorOf(event));
			if (parsed.data.saveDays) {
				await db
					.update(course)
					.set({ durationDays: parsed.data.saveDays })
					.where(eq(course.id, id));
				invalidate('catalog');
			}
			const plural = (n: number) => `${n} class${n === 1 ? '' : 'es'}`;
			return {
				done: skipped
					? `${plural(created)} created, ${plural(skipped)} already existed`
					: `${plural(created)} created`
			};
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
	},

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
				error: 'This class has registrations. Close or cancel it instead of deleting it.'
			});
		}
		const result = await intakes.actions.delete(event, courseId(event.params));
		refreshSchool();
		return result;
	}
};
