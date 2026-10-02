import { int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { LOCATION_KINDS } from '../../../constants';
import { lesserFields } from './secureFields';

/**
 * Where stock physically sits: the shop floor, the store room, the décor workshop. Every quantity
 * in the system is held at a location (`stock_balance`).
 *
 * `shop` is where sales take stock from first; `quarantine` is stock pulled off the shelf (expired,
 * recalled, damaged pending a decision) — it is never sold or issued, and does not count as
 * sellable. Amoria has one site, so there is no branch above this.
 */
export const location = mysqlTable('location', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	kind: mysqlEnum('kind', LOCATION_KINDS).notNull().default('storage'),
	sortOrder: int('sort_order').notNull().default(0),
	...lesserFields
});
