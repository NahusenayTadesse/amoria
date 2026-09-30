import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { db } from '$lib/server/db';
import { course, courseIntake, registration } from '$lib/server/db/schema';
import { REGISTRATION_STATUSES } from '$lib/constants';
import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '$lib/registrationStatus';

const FILTERS = ['status', 'intake', 'queue'] as const;
const SORTS = { createdAt: registration.createdAt, feeSnapshot: registration.feeSnapshot };

/**
 * A registration with a transfer receipt waiting for staff. Written out as
 * `registration`.`id`, not interpolated — see the same note in the orders list.
 */
const receiptWaiting = sql<number>`EXISTS (SELECT 1 FROM payment p WHERE p.registration_id = \`registration\`.\`id\` AND p.provider = 'bank_transfer' AND p.status = 'initiated')`;

/** The registrations someone has to do something about: a receipt to check, or paid with no seat. */
const needsAction = or(
	eq(registration.status, 'paid_unfulfillable'),
	and(eq(registration.status, 'pending_payment'), sql`${receiptWaiting}`)
);

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const queue = query.filters.queue === 'all' ? 'all' : 'action';
	const intakeId = Number(query.filters.intake) || null;

	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		// Looking at one intake shows all of its students, not just the ones needing action.
		base: [queue === 'action' && !intakeId ? needsAction : undefined],
		search: (term) =>
			or(
				like(registration.ref, `%${term}%`),
				like(registration.contactName, `%${term}%`),
				like(registration.contactPhone, `%${term.replace(/^0/, '')}%`)
			),
		dateColumn: registration.createdAt,
		filters: {
			status: (v) =>
				(REGISTRATION_STATUSES as readonly string[]).includes(v)
					? eq(registration.status, v as RegistrationStatus)
					: undefined,
			intake: (v) => (Number(v) ? eq(registration.intakeId, Number(v)) : undefined)
		}
	};
	const where = buildWhere(query, spec);

	const [rows, [{ total }], facets, [intake]] = await Promise.all([
		db
			.select({
				id: registration.id,
				ref: registration.ref,
				createdAt: registration.createdAt,
				contactName: registration.contactName,
				contactPhone: registration.contactPhone,
				fee: registration.feeSnapshot,
				status: registration.status,
				courseTitle: course.title,
				startDate: courseIntake.startDate,
				receiptWaiting
			})
			.from(registration)
			.innerJoin(courseIntake, eq(courseIntake.id, registration.intakeId))
			.innerJoin(course, eq(course.id, courseIntake.courseId))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(registration.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(registration).where(where),
		facetCounts({
			status: () =>
				db
					.select({ value: registration.status, count: count() })
					.from(registration)
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(registration.status)
					.then((list) => list.map((f) => ({ ...f, label: REGISTRATION_STATUS_LABELS[f.value] })))
		}),
		intakeId
			? db
					.select({ id: courseIntake.id, startDate: courseIntake.startDate, title: course.title })
					.from(courseIntake)
					.innerJoin(course, eq(course.id, courseIntake.courseId))
					.where(eq(courseIntake.id, intakeId))
			: Promise.resolve([])
	]);

	return {
		rows: rows.map((row) => ({ ...row, receiptWaiting: Boolean(Number(row.receiptWaiting)) })),
		queue,
		intake: intake ?? null,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
