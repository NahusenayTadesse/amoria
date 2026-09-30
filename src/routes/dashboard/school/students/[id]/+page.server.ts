import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { course, courseIntake, customer, registration } from '$lib/server/db/schema';
import { setRegistrationStatus, seatsTaken } from '$lib/server/services/school';
import {
	actorOf,
	paymentAdminActions,
	paymentsCardData,
	paymentsFor
} from '$lib/server/paymentAdmin';
import { registrationStatusSchema } from '$lib/schemas/dashboard';

function registrationId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Registration not found');
	return id;
}

export const load = async ({ params, locals }) => {
	const id = registrationId(params);
	const [row] = await db
		.select({
			registration,
			courseId: course.id,
			courseTitle: course.title,
			intakeId: courseIntake.id,
			startDate: courseIntake.startDate,
			endDate: courseIntake.endDate,
			scheduleText: courseIntake.scheduleText,
			seatLimit: courseIntake.seatLimit,
			email: customer.email
		})
		.from(registration)
		.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
		.innerJoin(course, eq(course.id, courseIntake.courseId))
		.innerJoin(customer, eq(customer.id, registration.customerId))
		.where(eq(registration.id, id));
	if (!row) error(404, 'Registration not found');

	const [payments, taken] = await Promise.all([
		paymentsFor('registration', id),
		seatsTaken(db, row.intakeId)
	]);

	return {
		registration: row.registration,
		course: { id: row.courseId, title: row.courseTitle },
		intake: {
			id: row.intakeId,
			startDate: row.startDate,
			endDate: row.endDate,
			scheduleText: row.scheduleText,
			seatLimit: row.seatLimit,
			taken
		},
		customerEmail: row.email,
		payments,
		...(await paymentsCardData({ locals })),
		statusForm: await superValidate(zod4(registrationStatusSchema))
	};
};

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'school.manage');
		const form = await superValidate(event.request, zod4(registrationStatusSchema));
		if (!form.valid) return fail(400, { error: 'Choose what the registration becomes.' });
		try {
			await setRegistrationStatus(
				registrationId(event.params),
				form.data.to,
				actorOf(event),
				form.data.note || undefined
			);
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
		return { done: 'Registration updated' };
	},

	...paymentAdminActions({ kind: 'registration', idOf: registrationId, noun: 'registration' })
};
