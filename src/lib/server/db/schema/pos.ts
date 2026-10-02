import {
	type AnyMySqlColumn,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar
} from 'drizzle-orm/mysql-core';
import { POS_METHODS, SHIFT_STATUSES } from '../../../constants';
import { user } from './auth';
import { birr } from './columns';
import { location } from './locations';
import { stockDocument } from './inventory';

/**
 * A till shift at the Mekanisa shop: opened with a float, closed by counting the drawer against
 * float + cash taken − cash paid out. The difference is recorded, not hidden.
 */
export const posShift = mysqlTable(
	'pos_shift',
	{
		id: int('id').autoincrement().primaryKey(),
		status: mysqlEnum('status', SHIFT_STATUSES).notNull().default('open'),
		/** Where the till takes its stock from: the shop floor. */
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		openedBy: varchar('opened_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		openedAt: timestamp('opened_at').defaultNow().notNull(),
		/** Cash in the drawer when it opened. */
		floatAmount: birr('float_amount').notNull().default(0),
		closedBy: varchar('closed_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		closedAt: datetime('closed_at'),
		/** What the drawer should hold, and what was counted, when closed. */
		expectedCash: birr('expected_cash'),
		countedCash: birr('counted_cash'),
		note: text('note')
	},
	(table) => [index('pos_shift_status_idx').on(table.status)]
);

/**
 * Money taken for one till sale (`stock_document` of type `issue` with a `shiftId`). A sale may be
 * paid by several methods; only cash gives change, taken off the cash payment.
 */
export const posPayment = mysqlTable(
	'pos_payment',
	{
		id: int('id').autoincrement().primaryKey(),
		documentId: int('document_id')
			.notNull()
			.references((): AnyMySqlColumn => stockDocument.id, { onDelete: 'restrict' }),
		shiftId: int('shift_id')
			.notNull()
			.references(() => posShift.id, { onDelete: 'restrict' }),
		method: mysqlEnum('method', POS_METHODS).notNull(),
		/** What the sale keeps (change already taken off cash). Negative for a refund. */
		amount: birr('amount').notNull(),
		/** A transfer or telebirr reference. */
		reference: varchar('reference', { length: 80 }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('pos_payment_document_idx').on(table.documentId),
		index('pos_payment_shift_idx').on(table.shiftId)
	]
);
