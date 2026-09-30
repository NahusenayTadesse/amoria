import { datetime, index, int, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { PAYMENT_PROVIDERS, PAYMENT_PURPOSES, PAYMENT_STATUSES } from '../../../constants';
import { user } from './auth';
import { orders } from './orders';
import { rentalBooking } from './rentals';
import { quote } from './decor';
import { registration } from './school';
import { birr, timestamps } from './columns';
import { lesserFields } from './secureFields';

/**
 * An account customers can transfer to: a bank account or a mobile wallet (Telebirr, CBE Birr).
 * Shown at checkout under "Bank transfer"; the customer uploads the receipt and staff confirm it
 * against the statement (`contentCrud` + `LookupPage`).
 */
export const bankAccount = mysqlTable('bank_account', {
	id: int('id').autoincrement().primaryKey(),
	/** As the customer knows it: "Commercial Bank of Ethiopia", "Telebirr". */
	bankName: varchar('bank_name', { length: 80 }).notNull(),
	accountName: varchar('account_name', { length: 120 }).notNull(),
	accountNumber: varchar('account_number', { length: 40 }).notNull(),
	sortOrder: int('sort_order').notNull().default(0),
	...lesserFields
});

/**
 * One payment attempt, online or recorded by staff (§7).
 *
 * Exactly one of `orderId`/`rentalBookingId`/`quoteId`/`registrationId` is set, matching `purpose`
 * — checked in the payment service, not by a `CHECK` constraint (§3.1).
 *
 * `txRef` is ours and unique: it is what Chapa echoes back, and the idempotency key that makes a
 * second webhook or return visit a no-op. `verifiedAt` is set once, by whichever confirmation got
 * there first, inside the transaction that calls `Payable.onPaid`.
 */
export const payment = mysqlTable(
	'payment',
	{
		id: int('id').autoincrement().primaryKey(),
		txRef: varchar('tx_ref', { length: 64 }).notNull().unique(),
		provider: mysqlEnum('provider', PAYMENT_PROVIDERS).notNull(),
		/** The provider's own reference: Chapa's, a bank FT number, a Telebirr ID. */
		providerRef: varchar('provider_ref', { length: 100 }),
		purpose: mysqlEnum('purpose', PAYMENT_PURPOSES).notNull(),
		orderId: int('order_id').references(() => orders.id, { onDelete: 'restrict' }),
		rentalBookingId: int('rental_booking_id').references(() => rentalBooking.id, {
			onDelete: 'restrict'
		}),
		quoteId: int('quote_id').references(() => quote.id, { onDelete: 'restrict' }),
		registrationId: int('registration_id').references(() => registration.id, {
			onDelete: 'restrict'
		}),
		/** Always read from the record, never from the client. */
		amount: birr('amount').notNull(),
		status: mysqlEnum('status', PAYMENT_STATUSES).notNull().default('initiated'),
		checkoutUrl: varchar('checkout_url', { length: 500 }),
		verifiedAt: datetime('verified_at'),
		/** The provider's verify response, truncated. For disputes, never parsed for logic. */
		verifyPayload: text('verify_payload'),
		/** Transfers: the account the customer says they paid into. */
		bankAccountId: int('bank_account_id').references(() => bankAccount.id, {
			onDelete: 'restrict'
		}),
		/** Transfers and manual payments: the receipt photo or PDF, in the kit's private store. */
		receiptFile: varchar('receipt_file', { length: 64 }),
		recordedBy: varchar('recorded_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		...timestamps()
	},
	(table) => [
		index('payment_status_idx').on(table.status, table.createdAt),
		index('payment_order_idx').on(table.orderId),
		index('payment_rental_idx').on(table.rentalBookingId),
		index('payment_quote_idx').on(table.quoteId),
		index('payment_registration_idx').on(table.registrationId)
	]
);
