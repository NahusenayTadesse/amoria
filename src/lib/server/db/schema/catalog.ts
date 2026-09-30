import {
	boolean,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { PRODUCT_KINDS, STOCK_REASONS } from '../../../constants';
import { user } from './auth';
import { birr } from './columns';
import { deletionFields, lesserFields, secureFields } from './secureFields';

/** Gift and rental categories: a kit `LookupPage` + `contentCrud`. */
export const category = mysqlTable(
	'category',
	{
		id: int('id').autoincrement().primaryKey(),
		kind: mysqlEnum('kind', PRODUCT_KINDS).notNull(),
		slug: varchar('slug', { length: 120 }).notNull().unique(),
		name: varchar('name', { length: 120 }).notNull(),
		nameAm: varchar('name_am', { length: 120 }),
		parentId: int('parent_id').references((): AnyMySqlColumn => category.id, {
			onDelete: 'restrict'
		}),
		sortOrder: int('sort_order').notNull().default(0),
		...lesserFields
	},
	(table) => [uniqueIndex('category_kind_name_idx').on(table.kind, table.name)]
);

/**
 * Gifts and rental equipment in one stock list (`contentCrud`, `references: [category]`).
 *
 * `stockQty` is written only by `services/stock.ts`, never by the CRUD form (its `transform` strips
 * it): gift units on hand, or rental units owned. Rental *availability* comes from bookings.
 */
export const product = mysqlTable(
	'product',
	{
		id: int('id').autoincrement().primaryKey(),
		kind: mysqlEnum('kind', PRODUCT_KINDS).notNull(),
		categoryId: int('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'restrict' }),
		slug: varchar('slug', { length: 160 }).notNull().unique(),
		name: varchar('name', { length: 160 }).notNull(),
		nameAm: varchar('name_am', { length: 160 }),
		description: text('description'),
		descriptionAm: text('description_am'),
		/** Gift sale price. Null for rental items. */
		price: birr('price'),
		/** Rental price per day. Null for gifts. */
		dailyRate: birr('daily_rate'),
		/** Rental security deposit **[Decision]** — keep 0 until refunds are designed (§5.4). */
		deposit: birr('deposit').notNull().default(0),
		minRentalDays: int('min_rental_days').notNull().default(1),
		stockQty: int('stock_qty').notNull().default(0),
		/** Null falls back to the `lowStockDefault` setting. */
		lowStockThreshold: int('low_stock_threshold'),
		isFeatured: boolean('is_featured').notNull().default(false),
		/** Null means hidden from the storefront; recent means "new arrival". */
		publishedAt: datetime('published_at'),
		sortOrder: int('sort_order').notNull().default(0),
		...secureFields
	},
	(table) => [
		index('product_kind_category_idx').on(table.kind, table.categoryId, table.publishedAt),
		index('product_featured_idx').on(table.isFeatured)
	]
);

export const productImage = mysqlTable(
	'product_image',
	{
		id: int('id').autoincrement().primaryKey(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('product_image_owner_idx').on(table.productId, table.sortOrder)]
);

/**
 * The stock ledger. Append-only: one row per change to `product.stockQty`, written by
 * `stock.move()` in the same transaction as the update, with the product row locked.
 *
 * `refType`/`refId` name what caused it (`order`, `rental_booking`, …) — a polymorphic pointer,
 * so no foreign key.
 */
export const stockMovement = mysqlTable(
	'stock_movement',
	{
		id: int('id').autoincrement().primaryKey(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		/** Signed: positive in, negative out. */
		delta: int('delta').notNull(),
		reason: mysqlEnum('reason', STOCK_REASONS).notNull(),
		refType: varchar('ref_type', { length: 20 }),
		refId: int('ref_id'),
		note: varchar('note', { length: 255 }),
		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(table) => [
		index('stock_movement_product_idx').on(table.productId, table.createdAt),
		index('stock_movement_ref_idx').on(table.refType, table.refId)
	]
);
