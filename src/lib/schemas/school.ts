import { z } from 'zod/v4';
import { m } from '$lib/paraglide/messages.js';
import { REGISTRATION_RESULTS } from '$lib/constants';
import { MAX_PLANNED_CLASSES } from '$lib/schoolPlan';
import { contactFields, paymentFields, requireTransferProof } from './checkout';

/**
 * Registering for a course: which class (a date range and shift, picked on the page), who, then
 * how they pay. The course comes from the URL; the server checks the class belongs to it.
 */
export const registrationSchema = z
	.object({
		intakeId: z.coerce
			.number({ error: () => m.reg_choose_class() })
			.int()
			.positive({ error: () => m.reg_choose_class() }),
		...contactFields,
		...paymentFields
	})
	.superRefine(requireTransferProof);

/* ------------------------------ Dashboard forms ------------------------------ */

const optionalText = (max: number) =>
	z.preprocess((v) => (v === null || v === undefined ? '' : v), z.string().trim().max(max));

/** One line per item, as typed into a box; the CRUD helper stores the lines as a list. */
const lines = () =>
	z.preprocess((v) => (Array.isArray(v) ? v.join('\n') : (v ?? '')), z.string().trim().max(4000));

const slug = z.preprocess(
	(v) => (v === null || v === undefined ? '' : v),
	z
		.string()
		.trim()
		.toLowerCase()
		.max(160)
		.regex(/^[a-z0-9-]*$/, 'Lowercase letters, digits and dashes only')
);

/** A whole number typed in a box that may be left empty (then `undefined`, stored as null). */
const optionalCount = (min: number, max: number, message: string) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? undefined : v),
		z.coerce.number().int().min(min, message).max(max, message).optional()
	);

const courseBase = z.object({
	title: z.string().trim().min(2, 'Enter the course name').max(160),
	titleAm: optionalText(160),
	slug,
	summary: optionalText(2000),
	summaryAm: optionalText(2000),
	curriculum: lines(),
	curriculumAm: lines(),
	fee: z.coerce.number().min(0, 'A fee cannot be negative'),
	durationText: optionalText(120),
	durationDays: optionalCount(1, 365, 'Between 1 and 365 days'),
	maxStudents: optionalCount(1, 500, 'Between 1 and 500 students'),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const courseAdd = courseBase;
export const courseEdit = courseBase.extend({ id: z.coerce.number() });

/** A calendar day typed or picked in a form: always a Gregorian `YYYY-MM-DD` (see the kit). */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');

function endAfterStart(data: { startDate: string; endDate?: string }, ctx: z.RefinementCtx) {
	if (data.endDate && data.endDate < data.startDate) {
		ctx.addIssue({
			code: 'custom',
			path: ['endDate'],
			message: 'The last day cannot be before the first'
		});
	}
}

const intakeBase = z.object({
	startDate: day,
	endDate: z.preprocess((v) => (v === '' || v === null ? undefined : v), day.optional()),
	shiftId: optionalCount(1, Number.MAX_SAFE_INTEGER, 'Choose a shift'),
	scheduleText: optionalText(160),
	seatLimit: z.coerce.number().int().min(1, 'At least one student').max(500),
	status: z.enum(['open', 'closed', 'completed', 'cancelled']).default('open')
});
export const intakeAdd = intakeBase.superRefine(endAfterStart);
export const intakeEdit = intakeBase.extend({ id: z.coerce.number() }).superRefine(endAfterStart);

/** A shift classes run in (morning, afternoon, night…). */
const shiftBase = z.object({
	name: z.string().trim().min(2, 'Name the shift, e.g. Morning').max(60),
	nameAm: optionalText(60),
	timeText: optionalText(60),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const shiftAdd = shiftBase;
export const shiftEdit = shiftBase.extend({ id: z.coerce.number() });

/** One class the builder planned, as posted back (a JSON list in one field). */
const plannedClass = z
	.object({
		startDate: day,
		endDate: day,
		shiftId: z.number().int().positive().nullable(),
		seatLimit: z.number().int().min(1, 'At least one student').max(500)
	})
	.refine((c) => c.endDate >= c.startDate, 'A class cannot end before it starts');

export const classBuilderSchema = z.object({
	classes: z.preprocess(
		(v) => {
			try {
				return typeof v === 'string' ? JSON.parse(v) : v;
			} catch {
				return null;
			}
		},
		z
			.array(plannedClass)
			.min(1, 'Nothing to create: give a date range long enough for one class')
			.max(MAX_PLANNED_CLASSES, `At most ${MAX_PLANNED_CLASSES} classes at a time`)
	),
	/** Also save the length used as the course's own. */
	saveDays: z.preprocess(
		(v) => (v === '' || v === undefined ? undefined : v),
		z.coerce.number().int().min(1).max(365).optional()
	)
});

/** Staff marking how a student finished. */
export const resultSchema = z.object({ result: z.enum(REGISTRATION_RESULTS) });
