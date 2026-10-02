import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { auditLog, payment, registration } from '$lib/server/db/schema';
import {
	actorFor,
	dayFromNow,
	guest,
	makeBankAccount,
	makeCourse,
	makeIntake,
	makeShift,
	makeStaff,
	resetDb,
	setSettings
} from '$lib/server/testing/db';
import { recordManualPayment, submitTransfer } from './payments';
import {
	certificateFor,
	classCourseSlug,
	createClasses,
	expireRegistrations,
	joinableIntake,
	register,
	registrationByToken,
	registrationPayable,
	schoolCourse,
	schoolCourses,
	setRegistrationStatus,
	setResult
} from './school';
import { courseIntake } from '$lib/server/db/schema';
import { planRuns, upcomingRanges } from '$lib/schoolPlan';

beforeEach(resetDb);

const person = (n: number) =>
	guest({ name: `Student ${n}`, phone: `+2519110000${String(n).padStart(2, '0')}` });

async function enrol(intakeId: number, n = 1) {
	return register({ intakeId, contact: person(n), sourceId: null });
}

async function statusOf(id: number) {
	const [row] = await db
		.select({ status: registration.status, hold: registration.holdExpiresAt })
		.from(registration)
		.where(eq(registration.id, id));
	return row;
}

/** Makes a hold run out, as time passing would. */
const expireHold = (id: number) =>
	db
		.update(registration)
		.set({ holdExpiresAt: new Date(Date.now() - 60_000) })
		.where(eq(registration.id, id));

/** Marks a registration paid the way a verified payment does. */
async function pay(id: number) {
	await recordManualPayment(
		'registration',
		id,
		{ provider: 'cash', reference: null, receiptFile: null },
		actorFor(null)
	);
}

describe('register', () => {
	it('takes a seat, copies the fee from the course, and holds it', async () => {
		const courseId = await makeCourse({ fee: 4500 });
		const intakeId = await makeIntake(courseId);
		await setSettings({ holdMinutes: 30 });

		const { id, token } = await enrol(intakeId);
		expect(token).toHaveLength(22);

		const [row] = await db.select().from(registration).where(eq(registration.id, id));
		expect(row).toMatchObject({
			status: 'pending_payment',
			feeSnapshot: 4500,
			intakeId,
			contactName: 'Student 1'
		});
		expect(row.ref).toBe(`AM-S-${String(id).padStart(6, '0')}`);
		const minutes = (row.holdExpiresAt!.getTime() - Date.now()) / 60_000;
		expect(minutes).toBeGreaterThan(28);
		expect(minutes).toBeLessThanOrEqual(30);
	});

	it('counts held seats, so the last seat goes to one person only', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 2 });
		await enrol(intakeId, 1);
		await enrol(intakeId, 2);

		await expect(enrol(intakeId, 3)).rejects.toThrow(/full/i);
		expect((await joinableIntake(intakeId))?.seatsLeft).toBe(0);
	});

	it('sells the last seat to exactly one of two people at once', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 1 });
		const results = await Promise.allSettled([enrol(intakeId, 1), enrol(intakeId, 2)]);

		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
		expect(refused.reason).toBeInstanceOf(WriteRefused);
	});

	it('refuses a closed intake, one that started, and a course taken off offer', async () => {
		const courseId = await makeCourse();
		const closed = await makeIntake(courseId, { status: 'closed' });
		const started = await makeIntake(courseId, { startDate: dayFromNow(-2) });
		await expect(enrol(closed)).rejects.toThrow(/closed/i);
		await expect(enrol(started)).rejects.toThrow(/closed/i);

		const offCourse = await makeCourse({ isActive: false });
		const gone = await makeIntake(offCourse);
		await expect(enrol(gone)).rejects.toThrow(/no longer on offer/i);
		expect(await joinableIntake(gone)).toBeNull();
	});

	it('does not give the same person two seats in one intake', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 5 });
		await enrol(intakeId, 1);
		await expect(enrol(intakeId, 1)).rejects.toThrow(/already have a seat/i);
	});

	it('lets someone register again once their hold has expired', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 5 });
		const first = await enrol(intakeId, 1);
		await expireHold(first.id);
		await expireRegistrations();

		await expect(enrol(intakeId, 1)).resolves.toBeTruthy();
	});
});

describe('expireRegistrations', () => {
	it('frees the seat of an unpaid registration whose hold ran out', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 1 });
		const first = await enrol(intakeId, 1);
		await expireHold(first.id);

		expect(await expireRegistrations()).toBe(1);
		expect((await statusOf(first.id)).status).toBe('expired');
		await expect(enrol(intakeId, 2)).resolves.toBeTruthy();
	});

	it('leaves a paid registration, and one whose hold is still running, alone', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 3 });
		const paid = await enrol(intakeId, 1);
		await pay(paid.id);
		await expireHold(paid.id);
		const running = await enrol(intakeId, 2);

		expect(await expireRegistrations()).toBe(0);
		expect((await statusOf(paid.id)).status).toBe('confirmed');
		expect((await statusOf(running.id)).status).toBe('pending_payment');
	});
});

describe('paying', () => {
	it('confirms the seat and clears the hold', async () => {
		const intakeId = await makeIntake(await makeCourse());
		const { id } = await enrol(intakeId);
		await pay(id);

		expect(await statusOf(id)).toMatchObject({ status: 'confirmed', hold: null });
		const [row] = await db.select().from(payment).where(eq(payment.registrationId, id));
		expect(row).toMatchObject({ purpose: 'registration', status: 'success', amount: 4500 });
	});

	it('refuses to start paying once the seat is gone', async () => {
		const intakeId = await makeIntake(await makeCourse());
		const { id } = await enrol(intakeId);
		await expireHold(id);
		await expireRegistrations();

		await expect(pay(id)).rejects.toThrow(/expired/i);
	});

	it('keeps the seat held while a transfer receipt is under review, and after a rejection gives a fresh hold', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 1 });
		const account = await makeBankAccount();
		const { id } = await enrol(intakeId);

		await submitTransfer('registration', id, { bankAccountId: account, receiptFile: 'r.jpg' });
		expect((await statusOf(id)).hold).toBeNull();

		// Held for review: not expired by the job, and still counted against the seat limit.
		expect(await expireRegistrations()).toBe(0);
		await expect(enrol(intakeId, 2)).rejects.toThrow(/full/i);

		const { rejectTransfer } = await import('./payments');
		const [receipt] = await db.select().from(payment).where(eq(payment.registrationId, id));
		await rejectTransfer(receipt.id, 'Not on the statement', actorFor(null));
		expect((await statusOf(id)).hold).not.toBeNull();
	});
});

describe('late payments (§7)', () => {
	/** Pays a registration that expired, through the Payable, as a late Chapa verify would. */
	async function payLate(id: number) {
		await db.transaction(async (tx) => {
			const [row] = await tx
				.insert(payment)
				.values({
					txRef: `late-${id}`,
					provider: 'chapa',
					purpose: 'registration',
					registrationId: id,
					amount: 4500,
					status: 'success'
				})
				.$returningId();
			const [paid] = await tx.select().from(payment).where(eq(payment.id, row.id));
			await registrationPayable.onPaid(tx, id, paid);
		});
	}

	it('takes a seat again if one is free', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 2 });
		const { id } = await enrol(intakeId);
		await expireHold(id);
		await expireRegistrations();

		await payLate(id);
		expect((await statusOf(id)).status).toBe('confirmed');
	});

	it('becomes paid_unfulfillable if the intake filled up meanwhile', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 1 });
		const late = await enrol(intakeId, 1);
		await expireHold(late.id);
		await expireRegistrations();
		await enrol(intakeId, 2); // takes the seat that just came free

		await payLate(late.id);
		expect((await statusOf(late.id)).status).toBe('paid_unfulfillable');
	});

	it('ignores a second payment for a registration that is already confirmed', async () => {
		const intakeId = await makeIntake(await makeCourse());
		const { id } = await enrol(intakeId);
		await pay(id);
		await payLate(id);
		expect((await statusOf(id)).status).toBe('confirmed');
	});
});

describe('setRegistrationStatus', () => {
	it('cancels a registration, releases the seat and audits it', async () => {
		const staff = await makeStaff();
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 1 });
		const { id } = await enrol(intakeId);
		await pay(id);

		await setRegistrationStatus(id, 'cancelled', actorFor(staff));
		expect((await statusOf(id)).status).toBe('cancelled');
		await expect(enrol(intakeId, 2)).resolves.toBeTruthy();

		const audited = await db.select().from(auditLog).where(eq(auditLog.tableName, 'registration'));
		expect(audited).toHaveLength(1);
	});

	it('refuses moves the table does not allow', async () => {
		const intakeId = await makeIntake(await makeCourse());
		const { id } = await enrol(intakeId);
		await expect(setRegistrationStatus(id, 'confirmed', actorFor(null))).rejects.toThrow(
			/cannot become/i
		);
	});

	it('rebooks a paid_unfulfillable student only when a seat is free', async () => {
		const intakeId = await makeIntake(await makeCourse(), { seatLimit: 1 });
		const late = await enrol(intakeId, 1);
		await db
			.update(registration)
			.set({ status: 'paid_unfulfillable', holdExpiresAt: null })
			.where(eq(registration.id, late.id));
		const other = await enrol(intakeId, 2);
		await pay(other.id);

		await expect(setRegistrationStatus(late.id, 'confirmed', actorFor(null))).rejects.toThrow(
			/still full/i
		);
	});
});

describe('public reads', () => {
	it('lists a course with its next intake that still has a seat', async () => {
		const courseId = await makeCourse({ title: 'Flower arches' });
		const full = await makeIntake(courseId, { startDate: dayFromNow(3), seatLimit: 1 });
		const open = await makeIntake(courseId, { startDate: dayFromNow(10), seatLimit: 4 });
		await enrol(full, 1);

		const [listed] = await schoolCourses();
		expect(listed.title).toBe('Flower arches');
		expect(listed.next).toMatchObject({ id: open, seatsLeft: 4 });

		const detail = await schoolCourse(listed.slug);
		expect(detail?.intakes.map((i) => [i.id, i.seatsLeft])).toEqual([
			[full, 0],
			[open, 4]
		]);
	});

	it('hides inactive and unknown courses', async () => {
		const off = await makeCourse({ isActive: false, slug: 'hidden' });
		await makeIntake(off);
		expect(await schoolCourses()).toEqual([]);
		expect(await schoolCourse('hidden')).toBeNull();
		expect(await schoolCourse('nope')).toBeNull();
	});

	it('finds a registration by its token, and nothing for a wrong one', async () => {
		const intakeId = await makeIntake(await makeCourse({ title: 'Balloon garlands' }));
		const { token } = await enrol(intakeId);

		const found = await registrationByToken(token);
		expect(found?.courseTitle).toBe('Balloon garlands');
		expect(found?.registration.contactName).toBe('Student 1');
		expect(await registrationByToken('x'.repeat(22))).toBeNull();
	});
});

describe('classes and shifts', () => {
	it('creates one class per run and shift, and skips ones that already exist', async () => {
		const courseId = await makeCourse();
		const morning = await makeShift({ name: 'Morning' });
		const afternoon = await makeShift({ name: 'Afternoon' });
		const runs = planRuns(dayFromNow(10), dayFromNow(10 + 39), 20);
		expect(runs).toHaveLength(2);
		const planned = runs.flatMap((run) =>
			[morning, afternoon].map((shiftId) => ({ ...run, shiftId, seatLimit: 12 }))
		);

		const staff = await makeStaff();
		expect(await createClasses(courseId, planned, actorFor(staff))).toEqual({
			created: 4,
			skipped: 0
		});
		// The same plan again doubles nothing.
		expect(await createClasses(courseId, planned, actorFor(staff))).toEqual({
			created: 0,
			skipped: 4
		});

		const rows = await db.select().from(courseIntake).where(eq(courseIntake.courseId, courseId));
		expect(rows).toHaveLength(4);
		expect(rows.every((r) => r.seatLimit === 12 && r.status === 'open')).toBe(true);
		const audits = await db.select().from(auditLog).where(eq(auditLog.tableName, 'course_intake'));
		expect(audits).toHaveLength(4);
	});

	it('refuses a shift that is no longer in use', async () => {
		const courseId = await makeCourse();
		const retired = await makeShift({ status: false });
		const [run] = planRuns(dayFromNow(10), dayFromNow(40), 20);
		await expect(
			createClasses(courseId, [{ ...run, shiftId: retired, seatLimit: 5 }], actorFor(null))
		).rejects.toBeInstanceOf(WriteRefused);
	});

	it('lets a student take the afternoon when the morning is full', async () => {
		const courseId = await makeCourse({ slug: 'arches' });
		const start = dayFromNow(10);
		const morning = await makeIntake(courseId, {
			startDate: start,
			shiftId: await makeShift({ name: 'Morning', sortOrder: 1 }),
			seatLimit: 1
		});
		const afternoon = await makeIntake(courseId, {
			startDate: start,
			shiftId: await makeShift({ name: 'Afternoon', sortOrder: 2 }),
			seatLimit: 2
		});

		await enrol(morning, 1);
		await expect(enrol(morning, 2)).rejects.toThrow(WriteRefused);
		await enrol(afternoon, 2);

		const detail = await schoolCourse('arches');
		const [range] = upcomingRanges(detail!.intakes);
		expect(range.classes.map((c) => [c.shiftName, c.seatsLeft])).toEqual([
			['Morning', 0],
			['Afternoon', 1]
		]);
		expect(range.seatsLeft).toBe(1);
		expect(await classCourseSlug(afternoon)).toBe('arches');
	});
});

describe('results and certificates', () => {
	async function finishedStudent() {
		const courseId = await makeCourse({ title: 'Table settings' });
		const intakeId = await makeIntake(courseId, {
			startDate: dayFromNow(7),
			endDate: dayFromNow(26)
		});
		const { id } = await enrol(intakeId);
		await pay(id);
		// The class has since run its course.
		await db
			.update(courseIntake)
			.set({ startDate: dayFromNow(-20), endDate: dayFromNow(-1) })
			.where(eq(courseIntake.id, intakeId));
		return { id, intakeId };
	}

	it('issues a certificate on graduating, and keeps its number if withdrawn and reissued', async () => {
		const { id } = await finishedStudent();
		const staff = actorFor(await makeStaff());

		await setResult(id, 'graduated', staff);
		const cert = await certificateFor({ id });
		expect(cert).toMatchObject({
			name: 'Student 1',
			courseTitle: 'Table settings',
			certificateNo: `AM-C-${String(id).padStart(6, '0')}`
		});

		await setResult(id, 'not_graduated', staff);
		expect(await certificateFor({ id })).toBeNull();

		await setResult(id, 'graduated', staff);
		expect((await certificateFor({ id }))?.certificateNo).toBe(cert!.certificateNo);
	});

	it('finds the certificate by the registration link', async () => {
		const { id } = await finishedStudent();
		await setResult(id, 'graduated', actorFor(null));
		const [row] = await db
			.select({ token: registration.publicToken })
			.from(registration)
			.where(eq(registration.id, id));
		expect((await certificateFor({ token: row.token }))?.certificateNo).toMatch(/^AM-C-/);
	});

	it('refuses a result before the last day, or for an unpaid student', async () => {
		const intakeId = await makeIntake(await makeCourse());
		const { id: unpaid } = await enrol(intakeId, 1);
		await expect(setResult(unpaid, 'graduated', actorFor(null))).rejects.toThrow(/confirmed/);

		const { id: early } = await enrol(intakeId, 2);
		await pay(early);
		await expect(setResult(early, 'graduated', actorFor(null))).rejects.toThrow(/last day/);
	});
});
