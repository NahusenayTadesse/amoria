import { datetime, index, int, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { FULFILMENTS, LOCALES, ORDER_STATUSES } from '../../../constants';
import { customer } from './customers';
import { product } from './catalog';
import { trafficSource } from './attribution';
import { birr, contactSnapshot, publicRecord, timestamps } from './columns';
import { lesserFields } from './secureFields';

/**
 * Where the shop delivers, and what it charges there (a kit `LookupPage`) — fixtec's
 * `place_names`. The customer picks one at checkout; the fee is always read from here on the
 * server, never from the form. An order at or above the `freeDeliveryThreshold` setting pays
 * nothing wherever it goes (`services/delivery.ts`).
 */
export const deliveryArea = mysqlTable('delivery_area', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	nameAm: varchar('name_am', { length: 100 }),
	fee: birr('fee').notNull(),
	sortOrder: int('sort_order').notNull().default(0),
	...lesserFields
});

/**
 * A gift shop order. Never deleted: it ends `cancelled` or `expired` (§5.0).
 *
 * The SQL table is `orders`, not `order`: `ORDER` is a reserved word, and every raw SQL line that
 * touched it would need backticks.
 *
 * Stock is reserved when the order is created (a `sale` movement) and held until `holdExpiresAt`;
 * an unpaid expired order gets `sale_cancel` movements (§5.3).
 */
export const orders = mysqlTable(
	'orders',
	{
		id: int('id').autoincrement().primaryKey(),
		...publicRecord(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		...contactSnapshot(),
		fulfilment: mysqlEnum('fulfilment', FULFILMENTS).notNull().default('pickup'),
		/** Delivery only: the area chosen, and its name at the time (a snapshot, §5.0). */
		deliveryAreaId: int('delivery_area_id').references(() => deliveryArea.id, {
			onDelete: 'restrict'
		}),
		deliveryAreaName: varchar('delivery_area_name', { length: 100 }),
		/** Delivery only: the street, building and landmark the customer typed. */
		deliveryAddress: varchar('delivery_address', { length: 255 }),
		subtotal: birr('subtotal').notNull(),
		deliveryFee: birr('delivery_fee').notNull().default(0),
		total: birr('total').notNull(),
		status: mysqlEnum('status', ORDER_STATUSES).notNull().default('pending_payment'),
		holdExpiresAt: datetime('hold_expires_at'),
		paidAt: datetime('paid_at'),
		sourceId: int('source_id').references(() => trafficSource.id, { onDelete: 'set null' }),
		locale: mysqlEnum('locale', LOCALES).notNull().default('en'),
		notes: text('notes'),
		...timestamps()
	},
	(table) => [
		index('orders_status_hold_idx').on(table.status, table.holdExpiresAt),
		index('orders_customer_idx').on(table.customerId, table.createdAt)
	]
);

export const orderItem = mysqlTable(
	'order_item',
	{
		id: int('id').autoincrement().primaryKey(),
		orderId: int('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		nameSnapshot: varchar('name_snapshot', { length: 160 }).notNull(),
		unitPrice: birr('unit_price').notNull(),
		qty: int('qty').notNull(),
		lineTotal: birr('line_total').notNull()
	},
	(table) => [index('order_item_order_idx').on(table.orderId)]
);
