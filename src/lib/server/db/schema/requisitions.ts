import {
	date,
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { REQUISITION_PURPOSES, REQUISITION_STATUSES } from '../../../constants';
import { user } from './auth';
import { product } from './catalog';
import { quote } from './decor';
import { location } from './locations';
import { deletionFields } from './secureFields';

/**
 * A team asking the store for materials: the décor crew for an event, the school for a class, the
 * shop for packaging. Written and submitted by the team, approved (quantities may be cut) by
 * someone who may, then filled by an ordinary issue from the store, which points back at it
 * (`stock_document.requisitionId`). Never deleted (§5.0): a dropped one is `cancelled`.
 */
export const requisition = mysqlTable(
	'requisition',
	{
		id: int('id').autoincrement().primaryKey(),
		/** Given when submitted, e.g. `AM-REQ-2019-00012`. */
		number: varchar('number', { length: 40 }).unique(),
		status: mysqlEnum('status', REQUISITION_STATUSES).notNull().default('draft'),
		purpose: mysqlEnum('purpose', REQUISITION_PURPOSES).notNull().default('decor'),
		/** Who is asking, as the team names itself: "Wedding crew", "Class 4". */
		requester: varchar('requester', { length: 120 }).notNull(),
		/** The décor job this is for, when there is one. */
		quoteId: int('quote_id').references(() => quote.id, { onDelete: 'set null' }),
		requestDate: date('request_date', { mode: 'string' }).notNull(),
		neededBy: date('needed_by', { mode: 'string' }),
		/** The store it is to come from. */
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		note: text('note'),
		submittedAt: datetime('submitted_at'),
		submittedBy: varchar('submitted_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		decidedAt: datetime('decided_at'),
		decidedBy: varchar('decided_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		decisionNote: varchar('decision_note', { length: 255 }),
		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [index('requisition_status_idx').on(table.status)]
);

export const requisitionLine = mysqlTable(
	'requisition_line',
	{
		id: int('id').autoincrement().primaryKey(),
		requisitionId: int('requisition_id')
			.notNull()
			.references(() => requisition.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		quantity: int('quantity').notNull(),
		/** What the approver allowed. Empty until decided: all of it. */
		approvedQuantity: int('approved_quantity'),
		note: varchar('note', { length: 255 }),
		// Soft delete for `childCrud`; purged when the requisition is submitted.
		...deletionFields
	},
	(table) => [index('requisition_line_req_idx').on(table.requisitionId)]
);
