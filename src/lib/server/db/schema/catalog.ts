import {
	boolean,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { PRODUCT_KINDS, TAX_CODES } from '../../../constants';
import { birr, unitCost } from './columns';
import { supplier } from './suppliers';
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
 * Everything the company stocks, in one list (`contentCrud`, `references: [category]`): gifts for
 * sale, rental equipment, and materials used by décor jobs and the school.
 *
 * `stockQty` is written only by `services/inventory/ledger`, never by the CRUD form (its
 * `transform` strips it). Rental *availability* comes from bookings.
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
		/**
		 * Units on hand that can be sold or issued: the sum of `stock_balance` over every location
		 * except quarantine. A cache, written only by `services/inventory/ledger` in the same
		 * transaction as the balances it sums.
		 */
		stockQty: int('stock_qty').notNull().default(0),
		/** The company's own code, printed on labels. Unique when given. */
		sku: varchar('sku', { length: 40 }).unique(),
		/** What the scanner reads. Unique when given. */
		barcode: varchar('barcode', { length: 40 }).unique(),
		/** What one unit is counted in: pcs, box, m, kg. A label only; quantities are whole numbers. */
		unit: varchar('unit', { length: 20 }).notNull().default('pcs'),
		/** Lot number and expiry are asked for on every delivery (chocolates, candles, flowers). */
		trackLots: boolean('track_lots').notNull().default(false),
		/** Moving-average cost per unit, moved only by stock coming in (`services/inventory/ledger`). */
		avgCost: unitCost('avg_cost').notNull().default(0),
		/** Where it normally comes from: the default supplier on a new purchase order. */
		mainSupplierId: int('main_supplier_id').references(() => supplier.id, {
			onDelete: 'set null'
		}),
		/** Standard-rated, zero-rated or exempt (VAT, §`settings.vatRegistered`). */
		taxCode: mysqlEnum('tax_code', TAX_CODES).notNull().default('standard'),
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
