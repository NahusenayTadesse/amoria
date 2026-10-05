import {
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import { LOCALES, PUSH_TARGETS } from '../../../constants';
import { timestamps } from './columns';

/**
 * A customer's phone or browser that asked to be told how an order or a class registration is
 * going (Web Push). There are no customer accounts, so a subscription belongs to the record it was
 * made from, reached by that record's link token, and is dropped when the push service says the
 * browser no longer exists. `targetId` points at `orders` or `registration` depending on
 * `targetType`, so there is no FK.
 */
export const pushSubscription = mysqlTable(
	'push_subscription',
	{
		id: int('id').autoincrement().primaryKey(),
		/** The push service's address for this browser; long, and not secret on its own. */
		endpoint: varchar('endpoint', { length: 500 }).notNull(),
		p256dh: varchar('p256dh', { length: 255 }).notNull(),
		auth: varchar('auth', { length: 64 }).notNull(),
		locale: mysqlEnum('locale', LOCALES).notNull().default('en'),
		targetType: mysqlEnum('target_type', PUSH_TARGETS).notNull(),
		targetId: int('target_id').notNull(),
		/** Set when the "your class starts tomorrow" reminder has been sent, so it goes once. */
		remindedAt: datetime('reminded_at'),
		...timestamps()
	},
	(table) => [
		uniqueIndex('push_subscription_endpoint_target_unique').on(
			table.endpoint,
			table.targetType,
			table.targetId
		),
		index('push_subscription_target_idx').on(table.targetType, table.targetId)
	]
);
