import { z } from 'zod/v4';
import { BUNDLE_TYPES, PRODUCT_KINDS, TAX_CODES } from '$lib/constants';
import { MAX_BUNDLE_DISCOUNT } from '$lib/bundle';

/** Catalog and shop-settings forms for the dashboard. Shared by the page and the action. */

/**
 * Optional text. Edit forms are seeded from the row, where an empty optional column is `null`, so
 * `null` reads as empty rather than failing "expected string".
 */
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

const slug = z.preprocess(
	(v) => (v === null || v === undefined ? '' : v),
	z
		.string()
		.trim()
		.toLowerCase()
		.max(160)
		.regex(/^[a-z0-9-]*$/, 'Lowercase letters, digits and dashes only')
);

const product = z.object({
	kind: z.enum(PRODUCT_KINDS).default('gift'),
	categoryId: z.coerce.number().int().positive('Choose a category'),
	name: z.string().trim().min(2, 'Enter a name').max(160),
	nameAm: optionalText(160),
	slug,
	price: optionalNumber(z.coerce.number().min(0)),
	dailyRate: optionalNumber(z.coerce.number().min(0)),
	deposit: z.coerce.number().min(0).default(0),
	minRentalDays: z.coerce.number().int().min(1).default(1),
	lowStockThreshold: optionalNumber(z.coerce.number().int().min(0)),
	/** The company's own code and what the scanner reads; unique when given (checked on the server). */
	sku: optionalText(40),
	barcode: optionalText(40),
	/** What one unit is counted in: pcs, box, m, kg. */
	unit: z.preprocess(
		(v) => (v === null || v === undefined || v === '' ? 'pcs' : v),
		z.string().trim().min(1).max(20)
	),
	trackLots: z.boolean().default(false),
	mainSupplierId: optionalId,
	taxCode: z.enum(TAX_CODES).default('standard'),
	isFeatured: z.boolean().default(false),
	/** Shown on the storefront. Stored as `publishedAt`, set the first time it is ticked. */
	published: z.boolean().default(true),
	description: optionalText(2000),
	descriptionAm: optionalText(2000),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});

/** A gift needs a sale price; rental equipment needs a daily rate. */
function priceForKind(data: z.infer<typeof product>, ctx: z.RefinementCtx) {
	if (data.kind === 'gift' && data.price === undefined) {
		ctx.addIssue({ code: 'custom', path: ['price'], message: 'A gift needs a price' });
	}
	if (data.kind === 'rental' && data.dailyRate === undefined) {
		ctx.addIssue({
			code: 'custom',
			path: ['dailyRate'],
			message: 'Rental equipment needs a daily rate'
		});
	}
}

export const productAdd = product.superRefine(priceForKind);
export const productEdit = product.extend({ id: z.coerce.number() }).superRefine(priceForKind);

/** A bundle (§5.2): its own name, text and photos; the price comes from its contents. */
const bundleBase = z.object({
	name: z.string().trim().min(2, 'Enter a name').max(160),
	nameAm: optionalText(160),
	slug,
	discountPercent: z.coerce
		.number('Enter a percentage')
		.min(0, 'Cannot be below 0')
		.max(MAX_BUNDLE_DISCOUNT, `At most ${MAX_BUNDLE_DISCOUNT}%`)
		.default(0),
	categoryId: optionalId,
	/** `fixed`: staff choose the gifts. `custom`: the customer fills the container. */
	type: z.enum(BUNDLE_TYPES).default('fixed'),
	/** The box, basket or wrap: a gift with rules. Required for `custom` (checked on the server). */
	containerId: optionalId,
	isFeatured: z.boolean().default(false),
	/** Stored as `publishedAt`, as on products. */
	published: z.boolean().default(false),
	description: optionalText(2000),
	descriptionAm: optionalText(2000),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const bundleAdd = bundleBase;
export const bundleEdit = bundleBase.extend({ id: z.coerce.number() });

/** One gift in a bundle, and how many of it. */
const bundleItemBase = z.object({
	productId: z.coerce.number('Choose a gift').int().positive('Choose a gift'),
	qty: z.coerce.number('Enter how many').int('A whole number').min(1, 'At least 1').max(20)
});
export const bundleItemAdd = bundleItemBase;
export const bundleItemEdit = bundleItemBase.extend({ id: z.coerce.number() });

/**
 * A container's rule: up to `maxQty` gifts of one category (or of one gift), and at least
 * `minQty`. Exactly one of the two is chosen.
 */
const containerRuleBase = z.object({
	categoryId: optionalId,
	productId: optionalId,
	minQty: z.coerce.number('Enter a number').int('A whole number').min(0).default(0),
	maxQty: z.coerce
		.number('Enter the most it holds')
		.int('A whole number')
		.min(1, 'At least 1')
		.max(500, 'At most 500')
});
function oneTarget(
	data: { categoryId?: number; productId?: number; minQty: number; maxQty: number },
	ctx: z.RefinementCtx
) {
	if (!data.categoryId === !data.productId) {
		ctx.addIssue({
			code: 'custom',
			path: ['categoryId'],
			message: 'Choose a category or one gift, not both'
		});
	}
	if (data.minQty > data.maxQty) {
		ctx.addIssue({ code: 'custom', path: ['minQty'], message: 'Cannot be more than the most' });
	}
}
export const containerRuleAdd = containerRuleBase.superRefine(oneTarget);
export const containerRuleEdit = containerRuleBase
	.extend({ id: z.coerce.number() })
	.superRefine(oneTarget);

const categoryBase = z.object({
	kind: z.enum(PRODUCT_KINDS).default('gift'),
	name: z.string().trim().min(2, 'Enter a name').max(120),
	nameAm: optionalText(120),
	slug,
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const categoryAdd = categoryBase;
export const categoryEdit = categoryBase.extend({ id: z.coerce.number() });

const areaBase = z.object({
	name: z.string().trim().min(2, 'Enter the area').max(100),
	nameAm: optionalText(100),
	fee: z.coerce.number().min(0, 'A fee cannot be negative'),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const deliveryAreaAdd = areaBase;
export const deliveryAreaEdit = areaBase.extend({ id: z.coerce.number() });

const accountBase = z.object({
	bankName: z.string().trim().min(2, 'Enter the bank or wallet').max(80),
	accountName: z.string().trim().min(2, 'Enter the account holder').max(120),
	accountNumber: z
		.string()
		.trim()
		.regex(/^[0-9 -]{6,40}$/, 'Digits only, as the customer should type them'),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean().default(true)
});
export const bankAccountAdd = accountBase;
export const bankAccountEdit = accountBase.extend({ id: z.coerce.number() });

/** Shop settings (§5.10) staff may change. Stored one row per key. */
export const shopSettingsSchema = z.object({
	holdMinutes: z.coerce.number().int().min(5, 'At least 5 minutes').max(1440),
	renterHoldHours: z.coerce
		.number()
		.int()
		.min(1, 'At least 1 hour')
		.max(168, 'At most a week (168 hours)')
		.default(24),
	deliveryEnabled: z.boolean().default(true),
	freeDeliveryThreshold: z.coerce.number().min(0),
	freeDeliverySuggestAt: z.coerce.number().min(0),
	lowStockDefault: z.coerce.number().int().min(0),
	expiryWarningDays: z.coerce.number().int().min(0).max(365),
	vatRegistered: z.boolean().default(false),
	vatRate: z.coerce.number().min(0).max(100),
	pricesIncludeVat: z.boolean().default(true),
	receiptFooter: z.string().trim().max(160).default(''),
	businessPhone: optionalText(30),
	whatsappNumber: optionalText(30),
	telegramUsername: optionalText(60),
	address: z.string().trim().max(200).default('')
});

/** A product photo. Compressed in the browser by the kit's `FileUpload` (≤1 MB, ≤1920 px). */
const imageFile = z
	.instanceof(File, { message: 'Choose a photo' })
	.refine((f) => f.size > 0, 'Choose a photo')
	.refine((f) => f.size <= 10 * 1024 * 1024, 'Up to 10 MB')
	.refine((f) => f.type.startsWith('image/'), 'A photo, not a document');

export const imageAdd = z.object({
	fileName: imageFile,
	alt: optionalText(160),
	altAm: optionalText(160),
	sortOrder: z.coerce.number().int().min(0).default(0)
});
export const imageEdit = z.object({
	id: z.coerce.number(),
	fileName: imageFile.optional(),
	alt: optionalText(160),
	altAm: optionalText(160),
	sortOrder: z.coerce.number().int().min(0).default(0)
});
