import { index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { LOCALES } from '../../../constants';
import { user } from './auth';
import { timestamps } from './columns';

/**
 * One person who has bought, booked, asked for a quote or registered — with or without an account.
 *
 * Created on the first guest purchase and keyed by the normalised phone number. Everything typed at
 * checkout is **unverified**, so this row is never an identity: nothing links or authorises through
 * `email`, and `userId` is set only after phone OTP or by staff (§4.2). Each record keeps its own
 * contact snapshot; guest checkout never overwrites a linked customer's name or email.
 */
export const customer = mysqlTable(
	'customer',
	{
		id: int('id').autoincrement().primaryKey(),
		/** Set when the account is proven to own this phone. Unique: one account, one customer. */
		userId: varchar('user_id', { length: 255 })
			.unique()
			.references(() => user.id, { onDelete: 'set null' }),
		name: varchar('name', { length: 120 }).notNull(),
		/** Normalised `+2519…` / `+2517…` (`normalizePhone`). The key guest checkout upserts by. */
		phone: varchar('phone', { length: 20 }).notNull().unique(),
		/** A contact hint only (see above). */
		email: varchar('email', { length: 190 }),
		/** Verified through the mini app's `initData` (§11). */
		telegramUserId: varchar('telegram_user_id', { length: 32 }).unique(),
		telegramChatId: varchar('telegram_chat_id', { length: 32 }),
		locale: mysqlEnum('locale', LOCALES).notNull().default('en'),
		defaultAddress: varchar('default_address', { length: 255 }),
		...timestamps()
	},
	(table) => [index('customer_email_idx').on(table.email)]
);
