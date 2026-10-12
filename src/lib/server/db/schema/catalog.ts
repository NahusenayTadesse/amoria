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
import { BUNDLE_TYPES, PRODUCT_KINDS, TAX_CODES } from '../../../constants';
import { birr, percent, unitCost } from './columns';
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

/**
 * A bundle: several gifts sold as one item at a discount (§5.2). It holds no stock of its own:
 * how many can be sold is read off its contents, and a sale takes each one from the ledger.
 *
 * Its price is never stored: it is the contents' current prices, less `discountPercent`, worked
 * out by `$lib/bundle` on every read and again at checkout, so a price change on a gift moves
 * every bundle it is in.
 */
export const bundle = mysqlTable(
	'bundle',
	{
		id: int('id').autoincrement().primaryKey(),
		/** Shares the shop's links with products (`?product=`, `/buy/`), so unique across both. */
		slug: varchar('slug', { length: 160 }).notNull().unique(),
		name: varchar('name', { length: 160 }).notNull(),
		nameAm: varchar('name_am', { length: 160 }),
		description: text('description'),
		descriptionAm: text('description_am'),
		/** `fixed`: staff choose the gifts. `custom`: the customer fills the container. */
		type: mysqlEnum('type', BUNDLE_TYPES).notNull().default('fixed'),
		/**
		 * The box, basket or wrap it comes in: a gift product with rules (`container_rule`). Sold
		 * with the bundle (its price and its stock), and its rules limit what goes in. Required for
		 * `custom`; optional for `fixed`.
		 */
		containerId: int('container_id').references((): AnyMySqlColumn => product.id, {
			onDelete: 'restrict'
		}),
		/** Off the sum of the contents' prices (container included), 0–90. */
		discountPercent: percent('discount_percent').notNull().default(0),
		/** Optional: a bundle in a category also shows under that category's chip on the shop. */
		categoryId: int('category_id').references(() => category.id, { onDelete: 'restrict' }),
		isFeatured: boolean('is_featured').notNull().default(false),
		/** Null means hidden from the storefront. */
		publishedAt: datetime('published_at'),
		sortOrder: int('sort_order').notNull().default(0),
		...secureFields
	},
	(table) => [index('bundle_published_idx').on(table.publishedAt)]
);

/** What is in a bundle: a gift and how many of it. One row per gift (checked in the action). */
export const bundleItem = mysqlTable(
	'bundle_item',
	{
		id: int('id').autoincrement().primaryKey(),
		bundleId: int('bundle_id')
			.notNull()
			.references(() => bundle.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		qty: int('qty').notNull().default(1),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('bundle_item_owner_idx').on(table.bundleId, table.sortOrder)]
);

export const bundleImage = mysqlTable(
	'bundle_image',
	{
		id: int('id').autoincrement().primaryKey(),
		bundleId: int('bundle_id')
			.notNull()
			.references(() => bundle.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('bundle_image_owner_idx').on(table.bundleId, table.sortOrder)]
);

/**
 * What fits in a container (a gift product used as a box, basket or wrap): how many gifts of a
 * category, or of one gift, it holds. A gift goes in only if a rule names it or its category (or
 * a parent category), and it counts towards every rule that names it, so "Toys: up to 3" and
 * "Teddy bear: up to 1" both apply to a teddy. A product with rules is a container.
 */
export const containerRule = mysqlTable(
	'container_rule',
	{
		id: int('id').autoincrement().primaryKey(),
		containerId: int('container_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		/** Exactly one of these two is set (checked in the action). */
		categoryId: int('category_id').references(() => category.id, { onDelete: 'restrict' }),
		productId: int('product_id').references(() => product.id, { onDelete: 'restrict' }),
		minQty: int('min_qty').notNull().default(0),
		maxQty: int('max_qty').notNull(),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('container_rule_owner_idx').on(table.containerId, table.sortOrder)]
);
