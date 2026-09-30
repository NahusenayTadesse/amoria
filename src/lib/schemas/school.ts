import { z } from 'zod/v4';
import { contactFields, paymentFields, requireTransferProof } from './checkout';

/** Registering for an intake: who, then how they pay. The intake comes from the URL. */
export const registrationSchema = z
	.object({ ...contactFields, ...paymentFields })
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
	scheduleText: optionalText(160),
	seatLimit: z.coerce.number().int().min(1, 'At least one seat').max(500),
	status: z.enum(['open', 'closed', 'completed', 'cancelled']).default('open')
});
export const intakeAdd = intakeBase.superRefine(endAfterStart);
export const intakeEdit = intakeBase.extend({ id: z.coerce.number() }).superRefine(endAfterStart);
