import { z } from 'zod/v4';
import {
	ADJUSTMENT_REASONS,
	DOCUMENT_TYPES,
	IMPORT_KIND_NAMES,
	LOCATION_KINDS,
	POS_METHODS,
	REQUISITION_PURPOSES
} from '$lib/constants';

/** Stock, purchasing, requisition and till forms for the dashboard. Shared by the page and the action. */

/** Edit forms are seeded from the row, where an empty optional column is `null`. */
const optionalText = (max: number) =>
	z.preprocess((v) => (v === null || v === undefined ? '' : v), z.string().trim().max(max));

/** An empty money or number box is "not set", not zero. */
const optionalNumber = <S extends z.ZodType>(schema: S) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? undefined : v),
		schema.optional()
	);

/** A picker left on "none" posts an empty string or 0. */
const optionalId = z.preprocess(
	(v) => (v === '' || v === null || v === undefined || v === '0' || v === 0 ? undefined : v),
	z.coerce.number().int().positive().optional()
);
const requiredId = (message: string) => z.coerce.number().int().positive(message);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
/** A date, or nothing. A string with a check, not a union: superforms cannot default a union. */
const optionalDay = z.preprocess(
	(v) => (v === null || v === undefined ? '' : v),
	z
		.string()
		.refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Choose a date')
		.default('')
);

/* ------------------------------ Suppliers and locations ------------------------------ */

const supplierBase = z.object({
	name: z.string().trim().min(2, 'Enter the supplier').max(160),
	phone: z.string().trim().min(6, 'Enter a phone number').max(30),
	email: z.preprocess(
		(v) => (v === null || v === undefined ? '' : v),
		z
			.string()
			.trim()
			.max(190)
			.refine((v) => v === '' || z.email().safeParse(v).success, 'That is not an email address')
			.default('')
	),
	address: optionalText(255),
	tin: optionalText(20),
	vatRegistered: z.boolean().default(false),
	leadTimeDays: optionalNumber(z.coerce.number().int().min(0).max(365)),
	status: z.boolean().default(true)
});
export const supplierAdd = supplierBase;
export const supplierEdit = supplierBase.extend({ id: z.coerce.number() });

const locationBase = z.object({
	name: z.string().trim().min(2, 'Enter the location').max(100),
	kind: z.enum(LOCATION_KINDS).default('storage'),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const locationAdd = locationBase;
export const locationEdit = locationBase.extend({ id: z.coerce.number() });

/* ------------------------------ Stock documents ------------------------------ */

/** The header of a draft document; which fields apply depends on its type (checked when posted). */
export const documentHeader = z.object({
	type: z.enum(DOCUMENT_TYPES),
	docDate: day,
	fromLocationId: optionalId,
	toLocationId: optionalId,
	supplierId: optionalId,
	customerId: optionalId,
	party: optionalText(160),
	reference: optionalText(80),
	reason: z.preprocess(
		(v) => (v === null || v === undefined ? '' : v),
		z
			.string()
			.refine(
				(v) => v === '' || (ADJUSTMENT_REASONS as readonly string[]).includes(v),
				'Choose a reason'
			)
			.default('')
	),
	note: optionalText(2000)
});

const documentLine = z.object({
	productId: requiredId('Choose a product'),
	quantity: z.coerce
		.number('Enter how many')
		.int('A whole number')
		.refine((n) => n !== 0, 'Enter how many'),
	unitCost: optionalNumber(z.coerce.number().min(0)),
	unitPrice: optionalNumber(z.coerce.number().min(0)),
	lotId: optionalId,
	lotNumber: optionalText(60),
	expiryDate: optionalDay,
	note: optionalText(255)
});
export const docLineAdd = documentLine;
export const docLineEdit = documentLine.extend({ id: z.coerce.number() });

/* ------------------------------ Purchasing ------------------------------ */

export const orderHeader = z.object({
	supplierId: requiredId('Choose a supplier'),
	orderDate: day,
	expectedDate: optionalDay,
	locationId: requiredId('Choose where it is delivered'),
	reference: optionalText(80),
	note: optionalText(2000)
});

const orderLine = z.object({
	productId: requiredId('Choose a product'),
	quantity: z.coerce.number('Enter how many').int('A whole number').min(1, 'At least 1'),
	unitCost: optionalNumber(z.coerce.number().min(0)),
	note: optionalText(255)
});
export const orderLineAdd = orderLine;
export const orderLineEdit = orderLine.extend({ id: z.coerce.number() });

/* ------------------------------ Counts ------------------------------ */

export const countOpen = z.object({
	locationId: requiredId('Choose a location'),
	categoryId: optionalId,
	countDate: day,
	blind: z.boolean().default(true),
	note: optionalText(2000)
});

export const countFound = z.object({
	productId: requiredId('Choose a product'),
	lotId: optionalId,
	counted: z.coerce.number('Enter how many').int('A whole number').min(0, 'Zero or more')
});

/* ------------------------------ Requisitions ------------------------------ */

export const requisitionHeader = z.object({
	purpose: z.enum(REQUISITION_PURPOSES).default('decor'),
	requester: z.string().trim().min(2, 'Say who is asking').max(120),
	quoteId: optionalId,
	requestDate: day,
	neededBy: optionalDay,
	locationId: requiredId('Choose the store it comes from'),
	note: optionalText(2000)
});

const requisitionLine = z.object({
	productId: requiredId('Choose a product'),
	quantity: z.coerce.number('Enter how many').int('A whole number').min(1, 'At least 1'),
	note: optionalText(255)
});
export const reqLineAdd = requisitionLine;
export const reqLineEdit = requisitionLine.extend({ id: z.coerce.number() });

export const requisitionDecision = z.object({
	approve: z.enum(['yes', 'no']),
	note: optionalText(255)
});

/* ------------------------------ Till ------------------------------ */

export const openShiftSchema = z.object({
	floatAmount: z.coerce.number('Enter the float').min(0, 'The float cannot be negative').default(0)
});
export const closeShiftSchema = z.object({
	countedCash: z.coerce.number('Enter the cash you counted').min(0, 'Zero or more'),
	note: optionalText(500)
});

/** What the till page posts: the basket and how it was paid, as one JSON field. */
export const checkoutPayload = z.object({
	lines: z
		.array(
			z.object({
				productId: z.number().int().positive(),
				quantity: z.number().int().min(1),
				unitPrice: z.number().min(0).optional()
			})
		)
		.min(1, 'The basket is empty')
		.max(60),
	payments: z
		.array(
			z.object({
				method: z.enum(POS_METHODS),
				amount: z.number().positive(),
				reference: z.string().trim().max(80).optional()
			})
		)
		.max(6)
});

export const tillReturnPayload = z.object({
	originalId: z.number().int().positive(),
	lines: z.array(
		z.object({ lineId: z.number().int().positive(), quantity: z.number().int().min(0) })
	),
	method: z.enum(POS_METHODS).default('cash')
});

/* ------------------------------ Import ------------------------------ */

export const importUpload = z.object({
	kind: z.enum(IMPORT_KIND_NAMES),
	file: z
		.instanceof(File, { message: 'Choose a file' })
		.refine((f) => f.size > 0, 'Choose a file')
		.refine((f) => f.size <= 5 * 1024 * 1024, 'Up to 5 MB')
});
