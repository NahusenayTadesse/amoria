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
import { PO_STATUSES } from '../../../constants';
import { user } from './auth';
import { product } from './catalog';
import { unitCost } from './columns';
import { location } from './locations';
import { deletionFields } from './secureFields';
import { supplier } from './suppliers';

/**
 * An order to a supplier. Drafted, then marked ordered (which gives it its number and is what the
 * supplier is sent). Goods arrive as ordinary goods receipts that point back at it: the ledger
 * never learns about orders, and the order's status follows what those receipts delivered.
 * Never deleted (§5.0): a dropped order is `cancelled`.
 */
export const purchaseOrder = mysqlTable(
	'purchase_order',
	{
		id: int('id').autoincrement().primaryKey(),
		supplierId: int('supplier_id')
			.notNull()
			.references(() => supplier.id, { onDelete: 'restrict' }),
		/** Assigned when ordered, e.g. `AM-PO-2019-00003`. */
		number: varchar('number', { length: 40 }).unique(),
		status: mysqlEnum('status', PO_STATUSES).notNull().default('draft'),
		orderDate: date('order_date', { mode: 'string' }).notNull(),
		expectedDate: date('expected_date', { mode: 'string' }),
		/** Where the goods should be delivered. */
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		reference: varchar('reference', { length: 80 }),
		note: text('note'),
		orderedAt: datetime('ordered_at'),
		orderedBy: varchar('ordered_by', { length: 255 }).references(() => user.id, {
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
	(table) => [
		index('purchase_order_status_idx').on(table.status),
		index('purchase_order_supplier_idx').on(table.supplierId)
	]
);

export const purchaseOrderLine = mysqlTable(
	'purchase_order_line',
	{
		id: int('id').autoincrement().primaryKey(),
		purchaseOrderId: int('purchase_order_id')
			.notNull()
			.references(() => purchaseOrder.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		quantity: int('quantity').notNull(),
		/** Agreed price per unit, copied onto the receipt as its cost. */
		unitCost: unitCost('unit_cost'),
		note: varchar('note', { length: 255 }),
		// Soft delete for `childCrud`; purged when the order is placed (`markOrdered`).
		...deletionFields
	},
	(table) => [index('purchase_order_line_po_idx').on(table.purchaseOrderId)]
);
