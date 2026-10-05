import {
	boolean,
	date,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import {
	CONTACT_CHANNELS,
	PACKAGE_TIERS,
	QUOTE_REQUEST_STATUSES,
	QUOTE_STATUSES
} from '../../../constants';
import { user } from './auth';
import { customer } from './customers';
import { trafficSource } from './attribution';
import { birr, contactSnapshot, jsonText, publicRecord, timestamps } from './columns';
import { deletionFields, lesserFields, secureFields } from './secureFields';

/** Wedding, birthday, engagement… (lookup: `LookupPage` + `contentCrud`). */
export const eventType = mysqlTable('event_type', {
	id: int('id').autoincrement().primaryKey(),
	slug: varchar('slug', { length: 60 }).notNull().unique(),
	name: varchar('name', { length: 80 }).notNull().unique(),
	nameAm: varchar('name_am', { length: 80 }),
	sortOrder: int('sort_order').notNull().default(0),
	...lesserFields
});

/**
 * A décor package (`contentCrud`, `listFields: ['inclusions', 'inclusionsAm']`). The inclusions are
 * entered one per line and stored as a JSON string array; a quote's line items can start from them.
 */
export const decorPackage = mysqlTable(
	'decor_package',
	{
		id: int('id').autoincrement().primaryKey(),
		slug: varchar('slug', { length: 160 }).notNull().unique(),
		eventTypeId: int('event_type_id')
			.notNull()
			.references(() => eventType.id, { onDelete: 'restrict' }),
		tier: mysqlEnum('tier', PACKAGE_TIERS).notNull(),
		name: varchar('name', { length: 160 }).notNull(),
		nameAm: varchar('name_am', { length: 160 }),
		summary: text('summary'),
		summaryAm: text('summary_am'),
		inclusions: jsonText('inclusions'),
		inclusionsAm: jsonText('inclusions_am'),
		startingPrice: birr('starting_price').notNull(),
		/** The word customers text or type in an ad reply, e.g. `BIRTHDAY`. */
		keyword: varchar('keyword', { length: 20 }),
		sortOrder: int('sort_order').notNull().default(0),
		...secureFields
	},
	(table) => [index('decor_package_event_idx').on(table.eventTypeId, table.tier)]
);

export const packageImage = mysqlTable(
	'package_image',
	{
		id: int('id').autoincrement().primaryKey(),
		packageId: int('package_id')
			.notNull()
			.references(() => decorPackage.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('package_image_owner_idx').on(table.packageId, table.sortOrder)]
);

export const portfolioItem = mysqlTable(
	'portfolio_item',
	{
		id: int('id').autoincrement().primaryKey(),
		slug: varchar('slug', { length: 160 }).notNull().unique(),
		title: varchar('title', { length: 160 }).notNull(),
		titleAm: varchar('title_am', { length: 160 }),
		eventTypeId: int('event_type_id').references(() => eventType.id, { onDelete: 'restrict' }),
		eventDate: date('event_date', { mode: 'string' }),
		venue: varchar('venue', { length: 160 }),
		description: text('description'),
		descriptionAm: text('description_am'),
		isFeatured: boolean('is_featured').notNull().default(false),
		sortOrder: int('sort_order').notNull().default(0),
		...secureFields
	},
	(table) => [index('portfolio_item_event_idx').on(table.eventTypeId, table.isFeatured)]
);

export const portfolioImage = mysqlTable(
	'portfolio_image',
	{
		id: int('id').autoincrement().primaryKey(),
		portfolioItemId: int('portfolio_item_id')
			.notNull()
			.references(() => portfolioItem.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('portfolio_image_owner_idx').on(table.portfolioItemId, table.sortOrder)]
);

/** What a customer submits from `/decor/quote`, or staff enter from a chat. */
export const quoteRequest = mysqlTable(
	'quote_request',
	{
		id: int('id').autoincrement().primaryKey(),
		publicToken: varchar('public_token', { length: 32 }).notNull().unique(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		...contactSnapshot(),
		eventTypeId: int('event_type_id').references(() => eventType.id, { onDelete: 'restrict' }),
		eventDate: date('event_date', { mode: 'string' }),
		venue: varchar('venue', { length: 160 }),
		guestCount: int('guest_count'),
		theme: varchar('theme', { length: 160 }),
		budget: birr('budget'),
		packageId: int('package_id').references(() => decorPackage.id, { onDelete: 'restrict' }),
		message: text('message'),
		preferredChannel: mysqlEnum('preferred_channel', CONTACT_CHANNELS).notNull().default('phone'),
		status: mysqlEnum('status', QUOTE_REQUEST_STATUSES).notNull().default('new'),
		assignedTo: varchar('assigned_to', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		sourceId: int('source_id').references(() => trafficSource.id, { onDelete: 'set null' }),
		/**
		 * Made by the browser for each request it sends, so a request queued offline and sent twice
		 * (a flaky connection, two tabs) is still one request.
		 */
		clientRef: varchar('client_ref', { length: 40 }).unique(),
		...timestamps()
	},
	(table) => [
		index('quote_request_status_idx').on(table.status, table.createdAt),
		index('quote_request_customer_idx').on(table.customerId)
	]
);

/**
 * A quote staff build — never automatic. A revision is a new quote; the old one becomes
 * `superseded` and its link points to `supersededById`.
 *
 * `viewedAt` is set only by the view beacon (`POST /q/[token]/viewed`), never by the page load,
 * because link previews and staff checks fetch the page too (§11).
 */
export const quote = mysqlTable(
	'quote',
	{
		id: int('id').autoincrement().primaryKey(),
		...publicRecord(),
		/** Nullable: staff can quote straight from a chat. */
		quoteRequestId: int('quote_request_id').references(() => quoteRequest.id, {
			onDelete: 'restrict'
		}),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		...contactSnapshot(),
		eventTypeId: int('event_type_id').references(() => eventType.id, { onDelete: 'restrict' }),
		eventDate: date('event_date', { mode: 'string' }),
		venue: varchar('venue', { length: 160 }),
		subtotal: birr('subtotal').notNull().default(0),
		discount: birr('discount').notNull().default(0),
		total: birr('total').notNull().default(0),
		/** Defaults to `total × depositPercent`; staff may edit it. */
		depositDue: birr('deposit_due').notNull().default(0),
		/** Sum of successful payments, kept by `quotes.markPaid`. */
		amountPaid: birr('amount_paid').notNull().default(0),
		status: mysqlEnum('status', QUOTE_STATUSES).notNull().default('draft'),
		validUntil: date('valid_until', { mode: 'string' }),
		sentAt: datetime('sent_at'),
		viewedAt: datetime('viewed_at'),
		acceptedAt: datetime('accepted_at'),
		supersededById: int('superseded_by_id').references((): AnyMySqlColumn => quote.id, {
			onDelete: 'restrict'
		}),
		customerNote: text('customer_note'),
		internalNote: text('internal_note'),
		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		...timestamps()
	},
	(table) => [
		index('quote_status_event_idx').on(table.status, table.eventDate),
		index('quote_customer_idx').on(table.customerId),
		index('quote_status_valid_idx').on(table.status, table.validUntil)
	]
);

/** Quote lines (`childCrud`, owner `quoteId`). Editable only while the quote is `draft`. */
export const quoteItem = mysqlTable(
	'quote_item',
	{
		id: int('id').autoincrement().primaryKey(),
		quoteId: int('quote_id')
			.notNull()
			.references(() => quote.id, { onDelete: 'restrict' }),
		description: varchar('description', { length: 255 }).notNull(),
		descriptionAm: varchar('description_am', { length: 255 }),
		qty: int('qty').notNull().default(1),
		unitPrice: birr('unit_price').notNull(),
		lineTotal: birr('line_total').notNull(),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('quote_item_owner_idx').on(table.quoteId, table.sortOrder)]
);
