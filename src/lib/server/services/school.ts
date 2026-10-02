import { and, asc, count, desc, eq, gte, inArray, lt, or, isNull, gt } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import {
	bankAccount,
	course,
	courseImage,
	courseIntake,
	customer,
	payment,
	registration,
	schoolShift
} from '$lib/server/db/schema';
import { cached, invalidate } from '$lib/server/cache';
import { formatRef, publicToken } from '$lib/server/tokens';
import { REGISTRATION_TRANSITIONS, type RegistrationStatus } from '$lib/registrationStatus';
import type { REGISTRATION_RESULTS } from '$lib/constants';
import { classKey, MAX_PLANNED_CLASSES } from '$lib/schoolPlan';
import { m } from '$lib/paraglide/messages.js';
import { upsertGuest, type GuestDetails } from './customers';
import { getSettings } from './settings';
import type { Actor, Payable, PayableState, PaymentRow } from './payments/payable';

/**
 * The décor school (§5.6, §11 "School"): courses, their intakes, and registration.
 *
 * A seat is taken the moment someone registers and held for `holdMinutes` while they pay, exactly
 * as an order holds stock. Seats left is never stored — it is counted, with the intake row locked,
 * every time it matters (`seatsTaken`).
 */

const TTL = 60_000;

/** Statuses whose money is in. A second payment against one of these changes nothing. */
const PAID_STATUSES: RegistrationStatus[] = ['confirmed', 'paid_unfulfillable'];

/**
 * Registrations that hold a seat: paid ones, and unpaid ones whose hold has not run out. A hold of
 * `NULL` is a transfer receipt under review (`holdForReview`), which keeps the seat until staff
 * decide.
 */
const holdsSeat = () =>
	or(
		eq(registration.status, 'confirmed'),
		and(
			eq(registration.status, 'pending_payment'),
			or(isNull(registration.holdExpiresAt), gt(registration.holdExpiresAt, new Date()))
		)
	);

/** How many seats of an intake are taken right now. */
export async function seatsTaken(reader: Pick<Writer, 'select'>, intakeId: number) {
	const [row] = await reader
		.select({ taken: count() })
		.from(registration)
		.where(and(eq(registration.intakeId, intakeId), holdsSeat()));
	return Number(row?.taken ?? 0);
}

/** An intake people can still join: open, and not yet started. */
const joinable = () =>
	and(
		eq(courseIntake.status, 'open'),
		gte(courseIntake.startDate, localToday()),
		notDeleted(courseIntake)
	);

/** The public course fields; `isActive` and soft delete are applied by the callers. */
const liveCourse = () => and(eq(course.isActive, true), notDeleted(course));

/* -------------------------------- Public reads -------------------------------- */

export type SchoolIntake = {
	id: number;
	startDate: string;
	endDate: string | null;
	scheduleText: string | null;
	seatLimit: number;
	seatsLeft: number;
	/** The class's shift (morning, afternoon…); all null for a course run in a single shift. */
	shiftId: number | null;
	shiftName: string | null;
	shiftNameAm: string | null;
	shiftTime: string | null;
};

/** The shift columns every public class read carries, from a left join on `school_shift`. */
const shiftColumns = {
	shiftId: courseIntake.shiftId,
	shiftName: schoolShift.name,
	shiftNameAm: schoolShift.nameAm,
	shiftTime: schoolShift.timeText
};

/** Classes in date order, and within a date range in shift order. */
const classOrder = [asc(courseIntake.startDate), asc(schoolShift.sortOrder), asc(courseIntake.id)];

export type SchoolCourse = {
	id: number;
	slug: string;
	title: string;
	titleAm: string | null;
	summary: string | null;
	summaryAm: string | null;
	fee: number;
	durationText: string | null;
	/** Days one run lasts; null means `DEFAULT_COURSE_DAYS`. */
	durationDays: number | null;
	image: string | null;
	imageAlt: string | null;
	/** The next intake with a seat, if any. */
	next: SchoolIntake | null;
};

/** Open, upcoming intakes of the given courses, each with its seats counted (one query per intake). */
async function intakesFor(courseIds: number[]): Promise<Map<number, SchoolIntake[]>> {
	const byCourse = new Map<number, SchoolIntake[]>();
	if (!courseIds.length) return byCourse;

	const rows = await db
		.select({
			id: courseIntake.id,
			courseId: courseIntake.courseId,
			startDate: courseIntake.startDate,
			endDate: courseIntake.endDate,
			scheduleText: courseIntake.scheduleText,
			seatLimit: courseIntake.seatLimit,
			...shiftColumns
		})
		.from(courseIntake)
		.leftJoin(schoolShift, eq(schoolShift.id, courseIntake.shiftId))
		.where(and(inArray(courseIntake.courseId, courseIds), joinable()))
		.orderBy(...classOrder);
	if (!rows.length) return byCourse;

	const taken = await db
		.select({ intakeId: registration.intakeId, taken: count() })
		.from(registration)
		.where(
			and(
				inArray(
					registration.intakeId,
					rows.map((row) => row.id)
				),
				holdsSeat()
			)
		)
		.groupBy(registration.intakeId);
	const takenBy = new Map(taken.map((row) => [row.intakeId, Number(row.taken)]));

	for (const row of rows) {
		const list = byCourse.get(row.courseId) ?? [];
		list.push({ ...row, seatsLeft: Math.max(0, row.seatLimit - (takenBy.get(row.id) ?? 0)) });
		byCourse.set(row.courseId, list);
	}
	return byCourse;
}

/** The first image of each course, in one query. */
async function firstImages(courseIds: number[]) {
	const first = new Map<number, { fileName: string; alt: string | null; altAm: string | null }>();
	if (!courseIds.length) return first;
	const rows = await db
		.select({
			courseId: courseImage.courseId,
			fileName: courseImage.fileName,
			alt: courseImage.alt,
			altAm: courseImage.altAm
		})
		.from(courseImage)
		.where(and(inArray(courseImage.courseId, courseIds), notDeleted(courseImage)))
		.orderBy(asc(courseImage.courseId), asc(courseImage.sortOrder), asc(courseImage.id));
	for (const row of rows) if (!first.has(row.courseId)) first.set(row.courseId, row);
	return first;
}

/** Every course on offer, each with its next intake that still has a seat. */
export function schoolCourses(): Promise<SchoolCourse[]> {
	return cached('school:courses', { ttlMs: TTL, tags: ['catalog'] }, async () => {
		const rows = await db
			.select({
				id: course.id,
				slug: course.slug,
				title: course.title,
				titleAm: course.titleAm,
				summary: course.summary,
				summaryAm: course.summaryAm,
				fee: course.fee,
				durationText: course.durationText,
				durationDays: course.durationDays
			})
			.from(course)
			.where(liveCourse())
			.orderBy(asc(course.sortOrder), asc(course.id));

		const ids = rows.map((row) => row.id);
		const [intakes, images] = await Promise.all([intakesFor(ids), firstImages(ids)]);

		return rows.map((row) => ({
			...row,
			image: images.get(row.id)?.fileName ?? null,
			imageAlt: images.get(row.id)?.alt ?? null,
			next: intakes.get(row.id)?.find((intake) => intake.seatsLeft > 0) ?? null
		}));
	});
}

export type SchoolCourseDetail = Omit<SchoolCourse, 'next' | 'image' | 'imageAlt'> & {
	curriculum: string[];
	curriculumAm: string[];
	images: { fileName: string; alt: string | null; altAm: string | null }[];
	intakes: SchoolIntake[];
};

function asList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
		: [];
}

/** One course by its link name, with photos, syllabus and every joinable intake. Null if none. */
export async function schoolCourse(slug: string): Promise<SchoolCourseDetail | null> {
	const [row] = await db
		.select({
			id: course.id,
			slug: course.slug,
			title: course.title,
			titleAm: course.titleAm,
			summary: course.summary,
			summaryAm: course.summaryAm,
			curriculum: course.curriculum,
			curriculumAm: course.curriculumAm,
			fee: course.fee,
			durationText: course.durationText,
			durationDays: course.durationDays
		})
		.from(course)
		.where(and(eq(course.slug, slug), liveCourse()));
	if (!row) return null;

	const [images, intakes] = await Promise.all([
		db
			.select({ fileName: courseImage.fileName, alt: courseImage.alt, altAm: courseImage.altAm })
			.from(courseImage)
			.where(and(eq(courseImage.courseId, row.id), notDeleted(courseImage)))
			.orderBy(asc(courseImage.sortOrder), asc(courseImage.id)),
		intakesFor([row.id])
	]);

	return {
		...row,
		curriculum: asList(row.curriculum),
		curriculumAm: asList(row.curriculumAm),
		images,
		intakes: intakes.get(row.id) ?? []
	};
}

/** What the registration page shows about one intake. Null if it cannot be joined. */
export async function joinableIntake(intakeId: number) {
	const [row] = await db
		.select({
			id: courseIntake.id,
			startDate: courseIntake.startDate,
			endDate: courseIntake.endDate,
			scheduleText: courseIntake.scheduleText,
			seatLimit: courseIntake.seatLimit,
			...shiftColumns,
			courseSlug: course.slug,
			courseTitle: course.title,
			courseTitleAm: course.titleAm,
			fee: course.fee
		})
		.from(courseIntake)
		.innerJoin(course, and(eq(course.id, courseIntake.courseId), liveCourse()))
		.leftJoin(schoolShift, eq(schoolShift.id, courseIntake.shiftId))
		.where(and(eq(courseIntake.id, intakeId), joinable()));
	if (!row) return null;
	return { ...row, seatsLeft: Math.max(0, row.seatLimit - (await seatsTaken(db, row.id))) };
}

/* -------------------------------- Registering -------------------------------- */

export type NewRegistration = {
	intakeId: number;
	contact: GuestDetails;
	sourceId: number | null;
};

/**
 * Registers a guest for an intake and takes their seat (§11 "School").
 *
 * The intake row is locked first, so two people registering for the last seat are taken one after
 * the other and the second is refused. The fee is copied from the course row — never from the
 * form — and the seat is held for `holdMinutes` while they pay; `expireRegistrations` gives it back.
 *
 * Refuses with `WriteRefused` (a sentence to act on) when the intake is closed, started, full, or
 * this person already has a seat in it.
 */
export async function register(input: NewRegistration) {
	const { holdMinutes } = await getSettings();

	const created = await transaction(async (tx) => {
		const [intake] = await tx
			.select({
				id: courseIntake.id,
				status: courseIntake.status,
				startDate: courseIntake.startDate,
				seatLimit: courseIntake.seatLimit,
				fee: course.fee,
				active: course.isActive,
				courseDeleted: course.deletedAt
			})
			.from(courseIntake)
			.innerJoin(course, eq(course.id, courseIntake.courseId))
			.where(and(eq(courseIntake.id, input.intakeId), notDeleted(courseIntake)))
			.for('update');

		if (!intake || !intake.active || intake.courseDeleted) {
			throw new WriteRefused(null, m.refused_intake_gone());
		}
		if (intake.status !== 'open' || intake.startDate < localToday()) {
			throw new WriteRefused(null, m.refused_intake_closed());
		}
		if ((await seatsTaken(tx, intake.id)) >= intake.seatLimit) {
			throw new WriteRefused(null, m.refused_intake_full());
		}

		const customerId = await upsertGuest(tx, input.contact);

		// The same person twice would only cost a seat: point them at the first registration.
		const [existing] = await tx
			.select({ id: registration.id })
			.from(registration)
			.where(
				and(
					eq(registration.intakeId, intake.id),
					eq(registration.customerId, customerId),
					holdsSeat()
				)
			)
			.limit(1);
		if (existing) throw new WriteRefused(null, m.refused_already_registered());

		const registrationId = await insertReturningId(tx, registration, {
			publicToken: publicToken(),
			intakeId: intake.id,
			customerId,
			contactName: input.contact.name,
			contactPhone: input.contact.phone,
			contactEmail: input.contact.email,
			feeSnapshot: intake.fee,
			status: 'pending_payment',
			holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
			sourceId: input.sourceId
		});
		await tx
			.update(registration)
			.set({ ref: formatRef('registration', registrationId) })
			.where(eq(registration.id, registrationId));

		const [row] = await tx
			.select({ id: registration.id, token: registration.publicToken })
			.from(registration)
			.where(eq(registration.id, registrationId));
		return row;
	});

	// A seat went: the pages' "seats left" come from the cached lists.
	invalidate('catalog');
	return created;
}

/* -------------------------------- Payments -------------------------------- */

export const registrationPayable: Payable = {
	kind: 'registration',

	statusPath: (token) => `/reg/${token}`,

	async lockForPayment(tx, id): Promise<PayableState | null> {
		const [row] = await tx.select().from(registration).where(eq(registration.id, id)).for('update');
		if (!row) return null;

		const canPay = row.status === 'pending_payment';
		return {
			id: row.id,
			token: row.publicToken,
			ref: row.ref,
			amountDue: row.feeSnapshot,
			canPay,
			reason: canPay
				? undefined
				: PAID_STATUSES.includes(row.status)
					? m.refused_already_paid()
					: m.refused_expired(),
			contact: { name: row.contactName, phone: row.contactPhone, email: row.contactEmail },
			description: `Registration ${row.ref ?? row.id}`
		};
	},

	/**
	 * Late payments (§7): money Chapa has verified is never ignored. A registration whose hold ran
	 * out (or that was cancelled) takes a seat again if one is still free; if not it becomes
	 * `paid_unfulfillable` for staff to rebook or refund. The intake row is locked for the count.
	 */
	async onPaid(tx, id, paid: PaymentRow) {
		const [row] = await tx
			.select({ status: registration.status, intakeId: registration.intakeId })
			.from(registration)
			.where(eq(registration.id, id))
			.for('update');
		if (!row) throw new Error(`onPaid: registration ${id} does not exist`);

		if (PAID_STATUSES.includes(row.status)) {
			console.warn(
				`Registration ${id} received another payment (${paid.txRef}) while ${row.status}.`
			);
			return;
		}

		let status: 'confirmed' | 'paid_unfulfillable' = 'confirmed';
		if (row.status !== 'pending_payment') {
			const [intake] = await tx
				.select({ seatLimit: courseIntake.seatLimit, status: courseIntake.status })
				.from(courseIntake)
				.where(eq(courseIntake.id, row.intakeId))
				.for('update');
			// This registration no longer holds a seat, so it is not in the count.
			const free =
				intake &&
				intake.status !== 'cancelled' &&
				(await seatsTaken(tx, row.intakeId)) < intake.seatLimit;
			if (!free) status = 'paid_unfulfillable';
		}

		await tx
			.update(registration)
			.set({ status, paidAt: new Date(), holdExpiresAt: null })
			.where(eq(registration.id, id));
	},

	async holdForReview(tx, id) {
		await tx.update(registration).set({ holdExpiresAt: null }).where(eq(registration.id, id));
	},

	async onPaymentRejected(tx, id) {
		const [row] = await tx
			.select({ status: registration.status })
			.from(registration)
			.where(eq(registration.id, id))
			.for('update');
		if (row?.status !== 'pending_payment') return;
		// Another receipt still waiting keeps the seat held for review.
		const [waiting] = await tx
			.select({ id: payment.id })
			.from(payment)
			.where(
				and(
					eq(payment.registrationId, id),
					eq(payment.provider, 'bank_transfer'),
					eq(payment.status, 'initiated')
				)
			)
			.limit(1);
		if (waiting) return;
		const { holdMinutes } = await getSettings();
		await tx
			.update(registration)
			.set({ holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000) })
			.where(eq(registration.id, id));
	}
};

/**
 * Moves a registration along by hand (§6: one service function per state change). The allowed
 * moves are `REGISTRATION_TRANSITIONS`, shared with the buttons. Confirming a `paid_unfulfillable`
 * one (staff found a seat) is checked against the intake's seats, all under lock.
 */
export async function setRegistrationStatus(
	registrationId: number,
	to: RegistrationStatus,
	actor: Actor,
	note?: string
) {
	await transaction(async (tx) => {
		const [row] = await tx
			.select({ status: registration.status, intakeId: registration.intakeId })
			.from(registration)
			.where(eq(registration.id, registrationId))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That registration does not exist.');
		if (!REGISTRATION_TRANSITIONS[row.status].includes(to)) {
			throw new WriteRefused(
				null,
				`A registration that is ${row.status.replace('_', ' ')} cannot become ${to.replace('_', ' ')}.`
			);
		}

		if (row.status === 'paid_unfulfillable' && to === 'confirmed') {
			const [intake] = await tx
				.select({ seatLimit: courseIntake.seatLimit })
				.from(courseIntake)
				.where(eq(courseIntake.id, row.intakeId))
				.for('update');
			if (!intake || (await seatsTaken(tx, row.intakeId)) >= intake.seatLimit) {
				throw new WriteRefused(
					null,
					'That class is still full. Raise its max students first, or cancel and refund.'
				);
			}
		}

		await tx
			.update(registration)
			.set({ status: to, holdExpiresAt: to === 'cancelled' ? null : undefined })
			.where(eq(registration.id, registrationId));
		await recordAudit(tx, actor, {
			table: 'registration',
			recordId: registrationId,
			action: 'update',
			before: { status: row.status },
			after: { status: to },
			detail: note ? { note } : undefined
		});
	});
	invalidate('catalog');
}

/**
 * Expires unpaid registrations whose hold has run out, which frees their seats (job
 * `expire-holds`). Bounded per run; each is re-checked under lock, so one paid a moment ago is
 * left alone.
 */
export async function expireRegistrations(limit = 50): Promise<number> {
	const due = await db
		.select({ id: registration.id })
		.from(registration)
		.where(
			and(eq(registration.status, 'pending_payment'), lt(registration.holdExpiresAt, new Date()))
		)
		.orderBy(asc(registration.holdExpiresAt))
		.limit(limit);

	let expired = 0;
	for (const { id } of due) {
		const done = await transaction(async (tx) => {
			const [row] = await tx
				.select({ status: registration.status, holdExpiresAt: registration.holdExpiresAt })
				.from(registration)
				.where(eq(registration.id, id))
				.for('update');
			if (
				row?.status !== 'pending_payment' ||
				!row.holdExpiresAt ||
				row.holdExpiresAt > new Date()
			) {
				return false;
			}
			await tx.update(registration).set({ status: 'expired' }).where(eq(registration.id, id));
			return true;
		});
		if (done) expired++;
	}

	if (expired) invalidate('catalog');
	return expired;
}

/** Everything `/reg/[token]` shows. Null for an unknown token. */
export async function registrationByToken(token: string) {
	const [row] = await db
		.select({
			registration,
			courseSlug: course.slug,
			courseTitle: course.title,
			courseTitleAm: course.titleAm,
			startDate: courseIntake.startDate,
			endDate: courseIntake.endDate,
			scheduleText: courseIntake.scheduleText,
			...shiftColumns
		})
		.from(registration)
		.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
		.innerJoin(course, eq(course.id, courseIntake.courseId))
		.leftJoin(schoolShift, eq(schoolShift.id, courseIntake.shiftId))
		.where(eq(registration.publicToken, token));
	if (!row) return null;

	const payments = await db
		.select({
			id: payment.id,
			txRef: payment.txRef,
			provider: payment.provider,
			status: payment.status,
			amount: payment.amount,
			createdAt: payment.createdAt,
			bankName: bankAccount.bankName
		})
		.from(payment)
		.leftJoin(bankAccount, eq(bankAccount.id, payment.bankAccountId))
		.where(eq(payment.registrationId, row.registration.id))
		.orderBy(desc(payment.id));

	return { ...row, payments };
}

/** The `customer` behind a registration, for the dashboard's contact card. */
export async function customerEmail(customerId: number) {
	const [row] = await db
		.select({ email: customer.email })
		.from(customer)
		.where(eq(customer.id, customerId));
	return row?.email ?? null;
}

/* ------------------------------ Class builder ------------------------------ */

export type PlannedClass = {
	startDate: string;
	endDate: string;
	shiftId: number | null;
	seatLimit: number;
};

/**
 * Creates a batch of classes for a course (the dashboard's class builder), in one transaction. A
 * class that already exists — same course, first day and shift — is skipped, not doubled, so
 * running the builder twice over the same months is harmless. Every shift must exist and be in use.
 */
export async function createClasses(courseId: number, planned: PlannedClass[], actor: Actor) {
	if (planned.length > MAX_PLANNED_CLASSES) {
		throw new WriteRefused(null, `At most ${MAX_PLANNED_CLASSES} classes at a time.`);
	}

	const result = await transaction(async (tx) => {
		const [owner] = await tx
			.select({ id: course.id })
			.from(course)
			.where(and(eq(course.id, courseId), notDeleted(course)))
			.for('update');
		if (!owner) throw new WriteRefused(null, 'That course does not exist.');

		const shiftIds = [...new Set(planned.flatMap((p) => (p.shiftId ? [p.shiftId] : [])))];
		if (shiftIds.length) {
			const live = await tx
				.select({ id: schoolShift.id })
				.from(schoolShift)
				.where(
					and(
						inArray(schoolShift.id, shiftIds),
						eq(schoolShift.status, true),
						notDeleted(schoolShift)
					)
				);
			if (live.length !== shiftIds.length) {
				throw new WriteRefused(null, 'One of the shifts is no longer in use. Reload the page.');
			}
		}

		const existing = await tx
			.select({ startDate: courseIntake.startDate, shiftId: courseIntake.shiftId })
			.from(courseIntake)
			.where(and(eq(courseIntake.courseId, courseId), notDeleted(courseIntake)));
		const taken = new Set(existing.map((row) => classKey(row.startDate, row.shiftId)));

		let created = 0;
		let skipped = 0;
		for (const row of planned) {
			const key = classKey(row.startDate, row.shiftId);
			if (taken.has(key)) {
				skipped++;
				continue;
			}
			taken.add(key);
			const id = await insertReturningId(tx, courseIntake, {
				courseId,
				startDate: row.startDate,
				endDate: row.endDate,
				shiftId: row.shiftId,
				seatLimit: row.seatLimit,
				status: 'open'
			});
			await recordAudit(tx, actor, {
				table: 'course_intake',
				recordId: id,
				action: 'create',
				after: { courseId, ...row },
				detail: { via: 'class builder' }
			});
			created++;
		}
		return { created, skipped };
	});

	if (result.created) invalidate('catalog');
	return result;
}

/**
 * Another live class of this course with the same first day and shift, other than `exceptId`.
 * The single-class form uses it to refuse a double; the builder skips them instead.
 */
export async function sameClassExists(
	courseId: number,
	startDate: string,
	shiftId: number | null,
	exceptId?: number
) {
	const conditions: (SQL | undefined)[] = [
		eq(courseIntake.courseId, courseId),
		eq(courseIntake.startDate, startDate),
		shiftId ? eq(courseIntake.shiftId, shiftId) : isNull(courseIntake.shiftId),
		notDeleted(courseIntake)
	];
	const rows = await db
		.select({ id: courseIntake.id })
		.from(courseIntake)
		.where(and(...conditions));
	return rows.some((row) => row.id !== exceptId);
}

/* -------------------------------- Results and certificates -------------------------------- */

export type RegistrationResult = (typeof REGISTRATION_RESULTS)[number];

/** The certificate's number, from the registration's id: `AM-C-000123`. */
export const certificateNumber = (registrationId: number) =>
	`AM-C-${String(registrationId).padStart(6, '0')}`;

/**
 * Marks how a student finished (§11 "School"): `graduated` issues their certificate, anything
 * else withdraws it. Only a confirmed (paid) student can be marked, and only once their class has
 * reached its last day. The certificate keeps its number if it is withdrawn and issued again.
 */
export async function setResult(registrationId: number, result: RegistrationResult, actor: Actor) {
	await transaction(async (tx) => {
		const [row] = await tx
			.select({
				status: registration.status,
				result: registration.result,
				certificateNo: registration.certificateNo,
				startDate: courseIntake.startDate,
				endDate: courseIntake.endDate
			})
			.from(registration)
			.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
			.where(eq(registration.id, registrationId))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That registration does not exist.');
		if (row.status !== 'confirmed') {
			throw new WriteRefused(null, 'Only a confirmed (paid) student can be given a result.');
		}
		if ((row.endDate ?? row.startDate) > localToday()) {
			throw new WriteRefused(null, 'The class has not reached its last day yet.');
		}
		if (row.result === result) return;

		const graduated = result === 'graduated';
		await tx
			.update(registration)
			.set({
				result,
				certificateNo: graduated
					? (row.certificateNo ?? certificateNumber(registrationId))
					: undefined,
				certificateIssuedAt: graduated ? new Date() : null
			})
			.where(eq(registration.id, registrationId));
		await recordAudit(tx, actor, {
			table: 'registration',
			recordId: registrationId,
			action: 'update',
			before: { result: row.result },
			after: { result }
		});
	});
}

/** What a printed certificate says. Null unless the student graduated. */
export async function certificateFor(where: { id: number } | { token: string }) {
	const [row] = await db
		.select({
			id: registration.id,
			name: registration.contactName,
			result: registration.result,
			certificateNo: registration.certificateNo,
			issuedAt: registration.certificateIssuedAt,
			courseTitle: course.title,
			courseTitleAm: course.titleAm,
			startDate: courseIntake.startDate,
			endDate: courseIntake.endDate,
			shiftName: schoolShift.name
		})
		.from(registration)
		.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
		.innerJoin(course, eq(course.id, courseIntake.courseId))
		.leftJoin(schoolShift, eq(schoolShift.id, courseIntake.shiftId))
		.where(
			'id' in where ? eq(registration.id, where.id) : eq(registration.publicToken, where.token)
		);
	if (!row || row.result !== 'graduated' || !row.certificateNo || !row.issuedAt) return null;
	return { ...row, certificateNo: row.certificateNo, issuedAt: row.issuedAt };
}

/** The link name of the course a class belongs to, for old `/school/register/<id>` links. */
export async function classCourseSlug(intakeId: number) {
	const [row] = await db
		.select({ slug: course.slug })
		.from(courseIntake)
		.innerJoin(course, eq(course.id, courseIntake.courseId))
		.where(eq(courseIntake.id, intakeId));
	return row?.slug ?? null;
}
