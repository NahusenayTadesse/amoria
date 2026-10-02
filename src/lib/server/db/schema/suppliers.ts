import { boolean, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';

/**
 * Who Amoria buys from: gift wholesalers, décor material shops, printers. A goods receipt names
 * one, so every unit that comes in can be traced back to where it came from.
 */
export const supplier = mysqlTable('supplier', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 160 }).notNull().unique(),
	phone: varchar('phone', { length: 30 }).notNull(),
	email: varchar('email', { length: 190 }),
	address: varchar('address', { length: 255 }),
	tin: varchar('tin', { length: 20 }),
	vatRegistered: boolean('vat_registered').notNull().default(false),
	/** Days from ordering to delivery, for reorder planning. Empty: assume a week. */
	leadTimeDays: int('lead_time_days'),
	...secureFields
});
