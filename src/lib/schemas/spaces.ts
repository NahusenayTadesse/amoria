import { z } from 'zod/v4';
import { isUsableYouTubeUrl } from '@nahu/admin-kit/youtube';

/** Rental-space forms for the dashboard. Shared by the page and the action. */

const optionalText = (max: number) =>
	z.preprocess((v) => (v === null || v === undefined ? '' : v), z.string().trim().max(max));

/** One line per item, as typed into a box; the CRUD helper stores the lines as a list. */
const lines = () =>
	z.preprocess((v) => (Array.isArray(v) ? v.join('\n') : (v ?? '')), z.string().trim().max(4000));

/** An empty box is "not set" (stored as null), not zero. */
const optionalNumber = <S extends z.ZodType>(schema: S) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? undefined : v),
		schema.optional()
	);

const slug = z.preprocess(
	(v) => (v === null || v === undefined ? '' : v),
	z
		.string()
		.trim()
		.toLowerCase()
		.max(160)
		.regex(/^[a-z0-9-]*$/, 'Lowercase letters, digits and dashes only')
);

const spaceBase = z.object({
	name: z.string().trim().min(2, 'Enter the name of the space').max(160),
	nameAm: optionalText(160),
	slug,
	summary: optionalText(2000),
	summaryAm: optionalText(2000),
	description: optionalText(6000),
	descriptionAm: optionalText(6000),
	features: lines(),
	featuresAm: lines(),
	capacity: optionalNumber(z.coerce.number().int().min(1, 'At least 1 guest').max(100000)),
	sizeText: optionalText(80),
	price: optionalNumber(z.coerce.number().min(0, 'A price cannot be negative')),
	priceUnit: optionalText(40),
	priceUnitAm: optionalText(40),
	youtubeUrl: optionalText(255).refine(
		(value) => !value || isUsableYouTubeUrl(value),
		'Paste a YouTube video link: youtube.com/watch?v=…, youtu.be/… or a Shorts link'
	),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});

export const spaceAdd = spaceBase;
export const spaceEdit = spaceBase.extend({ id: z.coerce.number() });
