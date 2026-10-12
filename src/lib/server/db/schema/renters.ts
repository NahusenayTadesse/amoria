import {
	boolean,
	date,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	varchar
} from 'drizzle-orm/mysql-core';
import {
	LISTING_PRICING,
	LISTING_STATUSES,
	PRICE_UNITS,
	RENTER_ORDER_ORIGINS,
	RENTER_ORDER_STATUSES,
	RENTER_PAYMENT_STATUSES,
	RENTER_STATUSES
} from '../../../constants';
import { user } from './auth';
import { category } from './catalog';
import { customer } from './customers';
import { birr, contactSnapshot, jsonText, publicRecord, timestamps } from './columns';
import { deletionFields, lesserFields } from './secureFields';

/**
 * The rental marketplace (§5.12): businesses that rent their own things out through Amoria.
 *
 * Money never passes through Amoria here. Renters cannot take Chapa; the customer transfers to the
 * renter's own bank account and the renter confirms the receipt, so these tables stand apart from
 * `payment` and the shared pipeline (§7), which is Amoria's own till.
 */

/**
 * A renter: the business behind one `renter` account. It may list nothing until staff have
 * checked its TIN and trade licence (`status = 'approved'`).
 *
 * `autoPublish` is staff trusting this renter: their listings go live without review.
 */
export const renter = mysqlTable(
	'renter',
	{
		id: int('id').autoincrement().primaryKey(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: 'restrict' }),
		/** Their page: `/renters/<slug>`. */
		slug: varchar('slug', { length: 120 }).notNull().unique(),
		businessName: varchar('business_name', { length: 160 }).notNull(),
		businessNameAm: varchar('business_name_am', { length: 160 }),
		/** One line under the name: "Sound and light for weddings since 2015". */
		tagline: varchar('tagline', { length: 160 }),
		taglineAm: varchar('tagline_am', { length: 160 }),
		about: text('about'),
		aboutAm: text('about_am'),
		/** Their terms: deposits, cancellations, damage. Shown on their page and every listing. */
		policies: text('policies'),
		policiesAm: text('policies_am'),
		/** Public photos (the kit's store, served at `/media`). */
		logoFile: varchar('logo_file', { length: 64 }),
		coverFile: varchar('cover_file', { length: 64 }),
		/** Where they are: "Bole, Addis Ababa". */
		area: varchar('area', { length: 120 }),
		/** Where they will deliver or work, as typed: "Addis Ababa, Adama, Bishoftu". */
		serviceAreas: varchar('service_areas', { length: 255 }),
		foundedYear: int('founded_year'),
		offersDelivery: boolean('offers_delivery').notNull().default(false),
		offersSetup: boolean('offers_setup').notNull().default(false),
		/** Public contact, normalised `+2519…`. */
		phone: varchar('phone', { length: 20 }).notNull(),
		whatsapp: varchar('whatsapp', { length: 20 }),
		telegram: varchar('telegram', { length: 40 }),

		// What staff check before approving. Private: never shown to guests.
		tinNumber: varchar('tin_number', { length: 20 }).notNull(),
		/** The trade licence as uploaded (photo or PDF), in the kit's private store. */
		tradeLicenceFile: varchar('trade_licence_file', { length: 64 }).notNull(),

		status: mysqlEnum('status', RENTER_STATUSES).notNull().default('pending'),
		/** Why it was turned down or suspended, as the renter sees it. */
		reviewNote: varchar('review_note', { length: 255 }),
		reviewedBy: varchar('reviewed_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		reviewedAt: datetime('reviewed_at'),
		/** First approval; "On Amoria since". */
		approvedAt: datetime('approved_at'),
		autoPublish: boolean('auto_publish').notNull().default(false),
		isFeatured: boolean('is_featured').notNull().default(false),
		...timestamps()
	},
	(table) => [index('renter_status_idx').on(table.status, table.createdAt)]
);

/** Where a renter's customers transfer to (`childCrud`, owner `renterId`). */
export const renterBankAccount = mysqlTable(
	'renter_bank_account',
	{
		id: int('id').autoincrement().primaryKey(),
		renterId: int('renter_id')
			.notNull()
			.references(() => renter.id, { onDelete: 'restrict' }),
		bankName: varchar('bank_name', { length: 80 }).notNull(),
		accountName: varchar('account_name', { length: 120 }).notNull(),
		accountNumber: varchar('account_number', { length: 40 }).notNull(),
		sortOrder: int('sort_order').notNull().default(0),
		...lesserFields
	},
	(table) => [index('renter_bank_account_owner_idx').on(table.renterId)]
);

/**
 * One thing a renter rents out: a hall, a tent, a sound system, 200 chairs (`childCrud`, owner
 * `renterId`, `listFields`-style JSON for the features). `categoryId` is one of Amoria's rental
 * categories, so the marketplace filters across renters.
 *
 * Shown only while `status = 'approved'` and its renter is approved. A change to a live listing
 * goes back to `pending_review` unless the renter is trusted (`renter.autoPublish`).
 */
export const renterListing = mysqlTable(
	'renter_listing',
	{
		id: int('id').autoincrement().primaryKey(),
		renterId: int('renter_id')
			.notNull()
			.references(() => renter.id, { onDelete: 'restrict' }),
		categoryId: int('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'restrict' }),
		slug: varchar('slug', { length: 160 }).notNull().unique(),
		name: varchar('name', { length: 160 }).notNull(),
		nameAm: varchar('name_am', { length: 160 }),
		summary: varchar('summary', { length: 255 }),
		summaryAm: varchar('summary_am', { length: 255 }),
		description: text('description'),
		descriptionAm: text('description_am'),
		/** One item per line: "2 × 1000 W speakers", "Generator included". */
		features: jsonText('features'),
		featuresAm: jsonText('features_am'),
		pricing: mysqlEnum('pricing', LISTING_PRICING).notNull().default('fixed'),
		/** Fixed pricing: birr per `priceUnit`. Quote pricing: an optional "from" figure. */
		price: birr('price'),
		priceUnit: mysqlEnum('price_unit', PRICE_UNITS).notNull().default('day'),
		/** Refundable deposit the renter asks for on top, if any. Shown, added to fixed totals. */
		deposit: birr('deposit').notNull().default(0),
		/** How many there are to rent at once; bookings over the same days share them. */
		quantity: int('quantity').notNull().default(1),
		/** Venues: guests it holds. */
		capacity: int('capacity'),
		youtubeUrl: varchar('youtube_url', { length: 255 }),
		deliveryAvailable: boolean('delivery_available').notNull().default(false),
		setupIncluded: boolean('setup_included').notNull().default(false),
		status: mysqlEnum('status', LISTING_STATUSES).notNull().default('draft'),
		reviewNote: varchar('review_note', { length: 255 }),
		reviewedBy: varchar('reviewed_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		reviewedAt: datetime('reviewed_at'),
		/** When it first went live; recent means "new" on the marketplace. */
		publishedAt: datetime('published_at'),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields,
		...timestamps()
	},
	(table) => [
		index('renter_listing_status_idx').on(table.status, table.categoryId),
		index('renter_listing_owner_idx').on(table.renterId, table.status)
	]
);

/** A listing's gallery (`photoGallery`, owner `listingId`). */
export const renterListingImage = mysqlTable(
	'renter_listing_image',
	{
		id: int('id').autoincrement().primaryKey(),
		listingId: int('listing_id')
			.notNull()
			.references(() => renterListing.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('renter_listing_image_owner_idx').on(table.listingId, table.sortOrder)]
);

/**
 * A customer's booking or quote request with a renter (`/rb/<token>`). One listing per order, or
 * none: a "custom quote" asked from the renter's page. Never deleted; it ends `completed`,
 * `declined`, `cancelled` or `expired`.
 *
 * Amounts stay null while a quote request waits for the renter's price.
 */
export const renterOrder = mysqlTable(
	'renter_order',
	{
		id: int('id').autoincrement().primaryKey(),
		...publicRecord(),
		renterId: int('renter_id')
			.notNull()
			.references(() => renter.id, { onDelete: 'restrict' }),
		listingId: int('listing_id').references(() => renterListing.id, { onDelete: 'restrict' }),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		...contactSnapshot(),
		origin: mysqlEnum('origin', RENTER_ORDER_ORIGINS).notNull(),
		/** The listing's name when asked, or "Custom request". */
		titleSnapshot: varchar('title_snapshot', { length: 160 }).notNull(),
		/** Inclusive Addis Ababa days. */
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }).notNull(),
		qty: int('qty').notNull().default(1),
		/** Hourly listings: how many hours. */
		hours: int('hours'),
		priceUnit: mysqlEnum('price_unit', PRICE_UNITS),
		unitPrice: birr('unit_price'),
		subtotal: birr('subtotal'),
		deposit: birr('deposit').notNull().default(0),
		total: birr('total'),
		/** Where it is needed, as typed: a venue, an address. */
		venue: varchar('venue', { length: 200 }),
		/** What the customer wrote. */
		message: text('message'),
		/** What the renter wrote with the quote, or why they declined or cancelled. */
		renterNote: text('renter_note'),
		quotedAt: datetime('quoted_at'),
		/** A quote can be accepted until the end of this day. */
		validUntil: date('valid_until', { mode: 'string' }),
		acceptedAt: datetime('accepted_at'),
		/** Unpaid bookings are released after this (job `expire-holds`). */
		holdExpiresAt: datetime('hold_expires_at'),
		/** When the renter confirmed the money. */
		paidAt: datetime('paid_at'),
		status: mysqlEnum('status', RENTER_ORDER_STATUSES).notNull(),
		locale: mysqlEnum('locale', ['en', 'am']).notNull().default('en'),
		...timestamps()
	},
	(table) => [
		index('renter_order_owner_idx').on(table.renterId, table.status, table.createdAt),
		index('renter_order_status_hold_idx').on(table.status, table.holdExpiresAt),
		index('renter_order_listing_dates_idx').on(table.listingId, table.startDate, table.endDate)
	]
);

/** A transfer receipt the customer sent to the renter, and what the renter made of it. */
export const renterPayment = mysqlTable(
	'renter_payment',
	{
		id: int('id').autoincrement().primaryKey(),
		orderId: int('order_id')
			.notNull()
			.references(() => renterOrder.id, { onDelete: 'restrict' }),
		bankAccountId: int('bank_account_id')
			.notNull()
			.references(() => renterBankAccount.id, { onDelete: 'restrict' }),
		/** What was owed when it was sent, from the order, never from the client. */
		amount: birr('amount').notNull(),
		/** The photo or PDF, in the kit's private store. */
		receiptFile: varchar('receipt_file', { length: 64 }).notNull(),
		status: mysqlEnum('status', RENTER_PAYMENT_STATUSES).notNull().default('submitted'),
		/** Why the renter turned it down, shown to the customer. */
		reviewNote: varchar('review_note', { length: 255 }),
		reviewedAt: datetime('reviewed_at'),
		...timestamps()
	},
	(table) => [
		index('renter_payment_order_idx').on(table.orderId),
		index('renter_payment_status_idx').on(table.status)
	]
);
