import {
	mysqlTable,
	mysqlEnum,
	varchar,
	text,
	timestamp,
	int,
	boolean,
	datetime,
	index,
	uniqueIndex,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { LOCALES, USER_ROLES } from '../../../constants';

/**
 * Identity is owned by better-auth, but `user` also carries Amoria's own columns, so it is declared
 * here rather than generated: `npm run auth:schema` would overwrite them (the dentalClinic
 * pattern). Anything better-auth must read back or accept has to be declared again under
 * `user.additionalFields` in `$lib/server/auth`.
 *
 * `id` is `varchar(255)` because every `createdBy`/`deletedBy` column from the kit's mixins is, and
 * MySQL refuses a foreign key whose types differ.
 */
export const user = mysqlTable(
	'user',
	{
		id: varchar('id', { length: 255 }).primaryKey(),

		// better-auth core.
		name: varchar('name', { length: 255 }).notNull(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),

		/**
		 * What kind of account this is. Never settable from sign-up (`input: false`), so a sign-up is
		 * always a `customer`; staff are created from the dashboard and admins are seeded (§4.1).
		 */
		role: mysqlEnum('role', USER_ROLES).notNull().default('customer'),

		/**
		 * The staff role whose permissions this user holds. Null for customers, who get
		 * `permList: []`. `restrict`: a role somebody still holds cannot be deleted from under them.
		 */
		roleId: int('role_id').references((): AnyMySqlColumn => roles.id, { onDelete: 'restrict' }),

		/** Normalised `+2519…`. Contact only; a customer's identity is their `customer` row (§4.2). */
		phone: varchar('phone', { length: 20 }),
		locale: mysqlEnum('locale', LOCALES).notNull().default('en'),
		/** Staff: where their personal Telegram alerts go. */
		telegramChatId: varchar('telegram_chat_id', { length: 32 }),

		/** The sign-in gate for staff who leave. Distinct from `deletedAt`: a deactivated user comes back. */
		isActive: boolean('is_active').default(true).notNull(),

		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull(),

		// `deletionFields` written inline: that module imports this one, so spreading it would close
		// an import cycle. No FK on `deleted_by`, as in dentalClinic: it would point at this table.
		deletedAt: datetime('deleted_at'),
		deletedBy: varchar('deleted_by', { length: 255 })
	},
	(table) => [index('user_role_idx').on(table.role)]
);

export const session = mysqlTable(
	'session',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		/** The value in the cookie. better-auth looks sessions up by it, so it must be indexed. */
		token: varchar('token', { length: 255 }).notNull().unique(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		expiresAt: datetime('expires_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [
		index('session_user_id_idx').on(table.userId),
		// The `cleanup` job deletes expired sessions by this.
		index('session_expires_idx').on(table.expiresAt)
	]
);

/** Credential and OAuth links. A password sign-in keeps its hash in `password` (`providerId = credential`). */
export const account = mysqlTable(
	'account',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		// varchar rather than the generator's `text`: sign-in looks rows up by this pair, and MySQL
		// cannot index a TEXT column without a prefix length.
		accountId: varchar('account_id', { length: 255 }).notNull(),
		providerId: varchar('provider_id', { length: 255 }).notNull(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: datetime('access_token_expires_at'),
		refreshTokenExpiresAt: datetime('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [
		index('account_user_id_idx').on(table.userId),
		uniqueIndex('account_provider_account_idx').on(table.providerId, table.accountId)
	]
);

/** Short-lived tokens: email verification and password resets. */
export const verification = mysqlTable(
	'verification',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		identifier: varchar('identifier', { length: 255 }).notNull(),
		value: text('value').notNull(),
		expiresAt: datetime('expires_at').notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [
		index('verification_identifier_idx').on(table.identifier),
		index('verification_expires_idx').on(table.expiresAt)
	]
);

/** Staff roles. Their permissions are rows in `role_permissions` (§4.4). */
export const roles = mysqlTable('roles', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 32 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	isActive: boolean('is_active').default(true).notNull(),
	// Inline for the same import-cycle reason as on `user`.
	deletedAt: datetime('deleted_at'),
	deletedBy: varchar('deleted_by', { length: 255 }).references((): AnyMySqlColumn => user.id, {
		onDelete: 'set null'
	})
});

export const userRelations = relations(user, ({ one, many }) => ({
	role: one(roles, { fields: [user.roleId], references: [roles.id] }),
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));
