import {
	boolean,
	date,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { COUNT_STATUSES } from '../../../constants';
import { user } from './auth';
import { category, product } from './catalog';
import { stockDocument, stockLot } from './inventory';
import { location } from './locations';

/**
 * A stock count of one location. Opening it takes a snapshot of what the system expects on each
 * shelf; people then enter what they found; posting turns the differences into one stock
 * adjustment (reason: count), so the count and the ledger stay two separate, checkable records.
 */
export const stockCount = mysqlTable(
	'stock_count',
	{
		id: int('id').autoincrement().primaryKey(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		/** Only this category, or everything at the location. */
		categoryId: int('category_id').references(() => category.id, { onDelete: 'set null' }),
		countDate: date('count_date', { mode: 'string' }).notNull(),
		status: mysqlEnum('status', COUNT_STATUSES).notNull().default('open'),
		/** Counters do not see the expected quantity, so they count rather than confirm. */
		blind: boolean('blind').notNull().default(true),
		note: text('note'),
		/** The adjustment the count posted, when it found differences. */
		adjustmentId: int('adjustment_id').references(() => stockDocument.id, {
			onDelete: 'set null'
		}),
		postedAt: datetime('posted_at'),
		postedBy: varchar('posted_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [index('stock_count_status_idx').on(table.status)]
);

export const stockCountLine = mysqlTable(
	'stock_count_line',
	{
		id: int('id').autoincrement().primaryKey(),
		countId: int('count_id')
			.notNull()
			.references(() => stockCount.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		lotId: int('lot_id').references(() => stockLot.id, { onDelete: 'restrict' }),
		/** `lotId` or 0, so (count, product, lot) can be unique. */
		lotKey: int('lot_key').notNull().default(0),
		/** What the system held when the count was opened. */
		expected: int('expected').notNull(),
		/** What was found. Null until counted. */
		counted: int('counted'),
		/** Found on the shelf but not in the snapshot. */
		addedDuringCount: boolean('added_during_count').notNull().default(false),
		note: varchar('note', { length: 255 }),
		countedBy: varchar('counted_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		uniqueIndex('stock_count_line_key_idx').on(table.countId, table.productId, table.lotKey)
	]
);
