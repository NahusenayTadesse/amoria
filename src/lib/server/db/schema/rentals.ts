import { date, datetime, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { RENTAL_STATUSES } from '../../../constants';
import { customer } from './customers';
import { product } from './catalog';
import { trafficSource } from './attribution';
import { birr, contactSnapshot, publicRecord, timestamps } from './columns';

/**
 * An equipment rental. `startDate`/`endDate` are inclusive Addis Ababa days (`date`, as strings,
 * so nothing shifts through a time zone).
 *
 * **Overdue is derived, not stored:** `status = 'out' AND endDate < localToday()`, in one helper.
 * **No double-booking** is enforced in `rentals.book()`: product rows locked, overlapping
 * `confirmed`/`out`/unexpired `pending_payment` quantities summed, refused over `stockQty` (§5.4).
 */
export const rentalBooking = mysqlTable(
	'rental_booking',
	{
		id: int('id').autoincrement().primaryKey(),
		...publicRecord(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		...contactSnapshot(),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }).notNull(),
		days: int('days').notNull(),
		subtotal: birr('subtotal').notNull(),
		deposit: birr('deposit').notNull().default(0),
		total: birr('total').notNull(),
		status: mysqlEnum('status', RENTAL_STATUSES).notNull().default('pending_payment'),
		holdExpiresAt: datetime('hold_expires_at'),
		paidAt: datetime('paid_at'),
		pickedUpAt: datetime('picked_up_at'),
		returnedAt: datetime('returned_at'),
		reminderSentAt: datetime('reminder_sent_at'),
		returnNote: varchar('return_note', { length: 255 }),
		sourceId: int('source_id').references(() => trafficSource.id, { onDelete: 'set null' }),
		...timestamps()
	},
	(table) => [
		index('rental_booking_status_end_idx').on(table.status, table.endDate),
		index('rental_booking_dates_idx').on(table.startDate, table.endDate),
		index('rental_booking_status_hold_idx').on(table.status, table.holdExpiresAt),
		index('rental_booking_customer_idx').on(table.customerId, table.createdAt)
	]
);

export const rentalBookingItem = mysqlTable(
	'rental_booking_item',
	{
		id: int('id').autoincrement().primaryKey(),
		bookingId: int('booking_id')
			.notNull()
			.references(() => rentalBooking.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		nameSnapshot: varchar('name_snapshot', { length: 160 }).notNull(),
		qty: int('qty').notNull(),
		dailyRateSnapshot: birr('daily_rate_snapshot').notNull(),
		lineTotal: birr('line_total').notNull()
	},
	(table) => [index('rental_booking_item_product_idx').on(table.productId, table.bookingId)]
);
