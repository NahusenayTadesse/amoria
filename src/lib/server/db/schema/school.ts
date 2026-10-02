import {
	date,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	varchar
} from 'drizzle-orm/mysql-core';
import { INTAKE_STATUSES, REGISTRATION_RESULTS, REGISTRATION_STATUSES } from '../../../constants';
import { customer } from './customers';
import { trafficSource } from './attribution';
import { birr, contactSnapshot, jsonText, publicRecord, timestamps } from './columns';
import { deletionFields, lesserFields, secureFields } from './secureFields';

/** A décor-school course (`contentCrud`, `listFields: ['curriculum', 'curriculumAm']`). */
export const course = mysqlTable('course', {
	id: int('id').autoincrement().primaryKey(),
	slug: varchar('slug', { length: 160 }).notNull().unique(),
	title: varchar('title', { length: 160 }).notNull(),
	titleAm: varchar('title_am', { length: 160 }),
	summary: text('summary'),
	summaryAm: text('summary_am'),
	curriculum: jsonText('curriculum'),
	curriculumAm: jsonText('curriculum_am'),
	fee: birr('fee').notNull(),
	/** Free text such as "6 weeks, Saturdays". */
	durationText: varchar('duration_text', { length: 120 }),
	/**
	 * How many days one run of the course lasts, which is also the gap between one class's first
	 * day and the next's. `NULL` means `DEFAULT_COURSE_DAYS` (20).
	 */
	durationDays: int('duration_days'),
	/** The seat limit the class builder suggests for new classes. `NULL`: typed each time. */
	maxStudents: int('max_students'),
	sortOrder: int('sort_order').notNull().default(0),
	...secureFields
});

export const courseImage = mysqlTable(
	'course_image',
	{
		id: int('id').autoincrement().primaryKey(),
		courseId: int('course_id')
			.notNull()
			.references(() => course.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('course_image_owner_idx').on(table.courseId, table.sortOrder)]
);

/**
 * A time of day classes run in: morning, afternoon, night… Staff name them, so a new shift needs
 * no code. A class without a shift (`courseIntake.shiftId` null) is the course's only one.
 */
export const schoolShift = mysqlTable('school_shift', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 60 }).notNull().unique(),
	nameAm: varchar('name_am', { length: 60 }),
	/** Shown beside the name, e.g. "8:30 to 12:00". */
	timeText: varchar('time_text', { length: 60 }),
	sortOrder: int('sort_order').notNull().default(0),
	...lesserFields
});

/**
 * One class: a run of a course over a date range, in one shift (`childCrud`, owner `courseId`).
 * The same dates in two shifts are two classes, each with its own seats.
 */
export const courseIntake = mysqlTable(
	'course_intake',
	{
		id: int('id').autoincrement().primaryKey(),
		courseId: int('course_id')
			.notNull()
			.references(() => course.id, { onDelete: 'restrict' }),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }),
		shiftId: int('shift_id').references(() => schoolShift.id, { onDelete: 'restrict' }),
		scheduleText: varchar('schedule_text', { length: 160 }),
		/**
		 * Max students in this class. Seats left = `seatLimit − confirmed − unexpired pending`,
		 * counted with this row locked.
		 */
		seatLimit: int('seat_limit').notNull(),
		status: mysqlEnum('status', INTAKE_STATUSES).notNull().default('open'),
		...deletionFields,
		...timestamps()
	},
	(table) => [
		index('course_intake_course_idx').on(table.courseId, table.status, table.startDate),
		index('course_intake_shift_idx').on(table.shiftId)
	]
);

export const registration = mysqlTable(
	'registration',
	{
		id: int('id').autoincrement().primaryKey(),
		...publicRecord(),
		intakeId: int('intake_id')
			.notNull()
			.references(() => courseIntake.id, { onDelete: 'restrict' }),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		...contactSnapshot(),
		feeSnapshot: birr('fee_snapshot').notNull(),
		status: mysqlEnum('status', REGISTRATION_STATUSES).notNull().default('pending_payment'),
		holdExpiresAt: datetime('hold_expires_at'),
		paidAt: datetime('paid_at'),
		/** Phase 2: set by staff, then the student is notified. */
		result: mysqlEnum('result', REGISTRATION_RESULTS).notNull().default('pending'),
		resultNotifiedAt: datetime('result_notified_at'),
		/**
		 * Given the first time the student is marked `graduated`, and kept after that, so a
		 * certificate never changes number. It is valid while `result` is `graduated`.
		 */
		certificateNo: varchar('certificate_no', { length: 32 }).unique(),
		certificateIssuedAt: datetime('certificate_issued_at'),
		sourceId: int('source_id').references(() => trafficSource.id, { onDelete: 'set null' }),
		...timestamps()
	},
	(table) => [
		index('registration_intake_idx').on(table.intakeId, table.status),
		index('registration_status_hold_idx').on(table.status, table.holdExpiresAt),
		index('registration_customer_idx').on(table.customerId)
	]
);
