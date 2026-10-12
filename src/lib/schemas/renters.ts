import { z } from 'zod/v4';
import { isEthiopianPhone } from '@nahu/admin-kit/phone';
import { isUsableYouTubeUrl } from '@nahu/admin-kit/youtube';
import { m } from '$lib/paraglide/messages.js';
import { LISTING_PRICING, PRICE_UNITS } from '$lib/constants';
import { MAX_HOURS, MAX_ORDER_QTY } from '$lib/rentalMarket';
import { contactFields } from './checkout';

/**
 * The rental marketplace's forms (§5.12). The storefront ones (join, book, ask for a quote) speak
 * the visitor's language; the renter and staff dashboards are in English, like the rest of the
 * dashboard.
 */

const MAX_FILE = 10 * 1024 * 1024;
const DOCUMENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/heic',
	'image/heif',
	'application/pdf'
];

const optionalText = (max: number) =>
	z.preprocess((v) => (v === null || v === undefined ? '' : v), z.string().trim().max(max));

/** An empty box is "not set" (stored as null), not zero. */
const optionalNumber = <S extends z.ZodType>(schema: S) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? undefined : v),
		schema.optional()
	);

/** One line per item, as typed into a box; stored as a list. */
const lines = () =>
	z.preprocess((v) => (Array.isArray(v) ? v.join('\n') : (v ?? '')), z.string().trim().max(4000));

/** An Ethiopian TIN: ten digits. Spaces and dashes as people type them are dropped. */
const tin = () =>
	z.preprocess(
		(v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : v),
		z.string().regex(/^\d{10}$/, { error: () => m.join_tin_invalid() })
	);

const licence = () =>
	z
		.instanceof(File, { error: () => m.join_licence_required() })
		.refine((f) => f.size > 0, { error: () => m.join_licence_required() })
		.refine((f) => f.size <= MAX_FILE, { error: () => m.checkout_receipt_too_big() })
		.refine((f) => DOCUMENT_TYPES.includes(f.type), { error: () => m.checkout_receipt_type() });

const isoDay = () =>
	z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => m.quote_date_invalid() });

const phone = () =>
	z
		.string()
		.trim()
		.refine(isEthiopianPhone, { error: () => m.checkout_phone_invalid() });

const optionalPhone = () =>
	z
		.string()
		.trim()
		.default('')
		.refine((v) => v === '' || isEthiopianPhone(v), { error: () => m.checkout_phone_invalid() });

// ------------------------------------------------------------------ storefront

/** "Rent out on Amoria": the account, the business and the papers staff check (`/renters/join`). */
export const renterJoinSchema = z.object({
	ownerName: z
		.string()
		.trim()
		.min(2, { error: () => m.checkout_name_required() })
		.max(120),
	email: z.email({ error: () => m.checkout_email_invalid() }).max(190),
	password: z
		.string()
		.min(8, { error: () => m.join_password_short() })
		.max(128),
	businessName: z
		.string()
		.trim()
		.min(2, { error: () => m.join_business_required() })
		.max(160),
	phone: phone(),
	area: z.string().trim().max(120).default(''),
	tinNumber: tin(),
	tradeLicence: licence(),
	/** A plain boolean: superforms reads a posted checkbox into one (a union it cannot). */
	agree: z
		.boolean()
		.default(false)
		.refine((v) => v, { error: () => m.join_agree_required() })
});

/** The dates and amount every marketplace order asks for. */
const orderFields = {
	...contactFields,
	startDate: isoDay(),
	/** Empty: the same day. */
	endDate: z.union([z.literal(''), isoDay()]).default(''),
	qty: z.coerce.number().int().min(1).max(MAX_ORDER_QTY).default(1),
	hours: optionalNumber(z.coerce.number().int().min(1).max(MAX_HOURS)),
	venue: z.string().trim().max(200).default(''),
	message: z.string().trim().max(1500).default('')
};

/** "Book now" on a fixed-price listing. */
export const bookSchema = z.object(orderFields);

/** "Ask for a quote", on a listing or (no listing) on the renter's page. */
export const askSchema = z.object(orderFields);

export type OrderInput = z.output<typeof bookSchema>;

// ------------------------------------------------------------------ renter dashboard

const image = () =>
	z
		.instanceof(File)
		.refine((f) => f.size <= MAX_FILE, 'Up to 10 MB')
		.refine((f) => f.size === 0 || f.type.startsWith('image/'), 'A photo, not a document')
		.optional();

/** The renter's shop profile: what makes their page theirs. */
export const renterProfileSchema = z.object({
	businessName: z.string().trim().min(2, 'Enter the business name').max(160),
	businessNameAm: optionalText(160),
	tagline: optionalText(160),
	taglineAm: optionalText(160),
	about: optionalText(6000),
	aboutAm: optionalText(6000),
	policies: optionalText(4000),
	policiesAm: optionalText(4000),
	area: optionalText(120),
	serviceAreas: optionalText(255),
	foundedYear: optionalNumber(
		z.coerce
			.number()
			.int()
			.min(1900, 'A year like 2015')
			.max(new Date().getFullYear(), 'That year has not come yet')
	),
	offersDelivery: z.boolean().default(false),
	offersSetup: z.boolean().default(false),
	phone: z.string().trim().refine(isEthiopianPhone, 'An Ethiopian phone number, e.g. 0911 234567'),
	whatsapp: optionalPhone(),
	telegram: optionalText(40).refine(
		(v) => v === '' || /^@?[A-Za-z0-9_]{5,32}$/.test(v),
		'A Telegram username, e.g. @amoria_rentals'
	),
	logoFile: image(),
	coverFile: image()
});

/** A turned-down renter sends their papers again. */
export const renterDocumentsSchema = z.object({
	tinNumber: tin(),
	tradeLicence: licence()
});

const accountBase = z.object({
	bankName: z.string().trim().min(2, 'The bank or wallet, e.g. CBE or Telebirr').max(80),
	accountName: z.string().trim().min(2, 'The name on the account').max(120),
	accountNumber: z
		.string()
		.trim()
		.min(4, 'The account or wallet number')
		.max(40)
		.regex(/^[0-9 +-]+$/, 'Digits only (spaces and dashes are fine)'),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const renterAccountAdd = accountBase;
export const renterAccountEdit = accountBase.extend({ id: z.coerce.number() });

/** A listing, as the renter fills it in. */
export const listingSchema = z
	.object({
		categoryId: z.coerce.number().int().positive('Choose what kind of rental it is'),
		name: z.string().trim().min(2, 'Name it, e.g. "Garden tent for 200 guests"').max(160),
		nameAm: optionalText(160),
		summary: optionalText(255),
		summaryAm: optionalText(255),
		description: optionalText(6000),
		descriptionAm: optionalText(6000),
		features: lines(),
		featuresAm: lines(),
		pricing: z.enum(LISTING_PRICING).default('fixed'),
		price: optionalNumber(z.coerce.number().min(0, 'A price cannot be negative').max(100_000_000)),
		priceUnit: z.enum(PRICE_UNITS).default('day'),
		deposit: z.coerce.number().min(0, 'A deposit cannot be negative').max(100_000_000).default(0),
		quantity: z.coerce
			.number()
			.int()
			.min(1, 'At least 1')
			.max(MAX_ORDER_QTY, `At most ${MAX_ORDER_QTY}`)
			.default(1),
		capacity: optionalNumber(z.coerce.number().int().min(1).max(100_000)),
		youtubeUrl: optionalText(255).refine(
			(value) => !value || isUsableYouTubeUrl(value),
			'Paste a YouTube video link: youtube.com/watch?v=…, youtu.be/… or a Shorts link'
		),
		deliveryAvailable: z.boolean().default(false),
		setupIncluded: z.boolean().default(false)
	})
	.superRefine((data, ctx) => {
		if (data.pricing === 'fixed' && !(data.price && data.price > 0)) {
			ctx.addIssue({
				code: 'custom',
				path: ['price'],
				message: 'A fixed-price rental needs its price. Choose "Quote only" to name it per request.'
			});
		}
	});

export type ListingInput = z.output<typeof listingSchema>;

/** The renter's price for a request. */
export const sendQuoteSchema = z.object({
	subtotal: z.coerce.number().positive('The price for the whole request').max(100_000_000),
	deposit: z.coerce.number().min(0).max(100_000_000).default(0),
	validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the last day it can be accepted'),
	note: z.string().trim().max(2000).default('')
});

/** Declining, cancelling, turning down a receipt: always with a reason for the customer. */
export const reasonSchema = z.object({
	reason: z.string().trim().min(3, 'Say why, for the customer').max(255)
});

export const renterReceiptRejectSchema = reasonSchema.extend({
	paymentId: z.coerce.number().int().positive()
});

// ------------------------------------------------------------------ staff

/** Turning a renter or a listing down: the reason is what they read. */
export const reviewNoteSchema = z.object({
	note: z.string().trim().min(3, 'Say what to fix, for the renter').max(255)
});
