import {
	datetime,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	tinyint,
	varchar
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { LOCALES, MESSAGE_CHANNELS, MESSAGE_STATUSES } from '../../../constants';
import { user } from './auth';
import { jsonText } from './columns';

/**
 * The outbox (§8). Rows are written by `outbox.enqueue` inside the transaction that caused them
 * and sent by the `send-messages` job; nothing sends inline.
 *
 * Retries back off at 1, 5 and 30 minutes (`nextAttemptAt`), then the row is `failed` and staff are
 * alerted. `relatedType`/`relatedId` point at the record it is about, polymorphically, so no FK.
 */
export const message = mysqlTable(
	'message',
	{
		id: int('id').autoincrement().primaryKey(),
		channel: mysqlEnum('channel', MESSAGE_CHANNELS).notNull(),
		/** A phone number, an email address or a Telegram chat id, depending on `channel`. */
		recipient: varchar('recipient', { length: 190 }).notNull(),
		template: varchar('template', { length: 50 }).notNull(),
		locale: mysqlEnum('locale', LOCALES).notNull().default('en'),
		/** The template's parameters. Opaque: read back whole, never queried into. */
		params: jsonText('params'),
		status: mysqlEnum('status', MESSAGE_STATUSES).notNull().default('queued'),
		attempts: tinyint('attempts').notNull().default(0),
		nextAttemptAt: datetime('next_attempt_at'),
		lastError: varchar('last_error', { length: 255 }),
		providerMessageId: varchar('provider_message_id', { length: 100 }),
		relatedType: varchar('related_type', { length: 20 }),
		relatedId: int('related_id'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		sentAt: datetime('sent_at')
	},
	(table) => [
		index('message_status_next_idx').on(table.status, table.nextAttemptAt),
		index('message_related_idx').on(table.relatedType, table.relatedId)
	]
);

/**
 * Business settings as key/value rows, typed by the zod schema in `services/settings.ts` and cached
 * (§5.10). A missing key reads as that schema's default, so a new setting needs no migration.
 */
export const setting = mysqlTable('setting', {
	key: varchar('key', { length: 64 }).primaryKey(),
	value: text('value').notNull(),
	updatedBy: varchar('updated_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull()
});

/**
 * One row per background job (§9). A job runs only if the conditional `UPDATE` on its row takes
 * the lock, so the runner inserts every registry entry's row at boot (`INSERT IGNORE`) — a
 * missing row would mean the job silently never runs.
 */
export const jobLock = mysqlTable('job_lock', {
	name: varchar('name', { length: 64 }).primaryKey(),
	lockedUntil: datetime('locked_until'),
	lastRunAt: datetime('last_run_at'),
	lastError: varchar('last_error', { length: 255 })
});

/**
 * The kit's audit trail (`recordAudit`), passed to `configureKit({ auditLog })`. Columns are the
 * ones the kit writes. `branchId` stays null: Amoria has one site.
 *
 * Changed fields only (`{ field: [before, after] }`), and one index — dentalClinic measured this
 * shape at 30× smaller and 15× faster to write than full-row snapshots.
 */
export const auditLog = mysqlTable(
	'audit_log',
	{
		id: int('id').autoincrement().primaryKey(),
		userId: varchar('user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		action: varchar('action', { length: 20 }).notNull(),
		tableName: varchar('table_name', { length: 64 }).notNull(),
		recordId: varchar('record_id', { length: 64 }).notNull(),
		changes: jsonText('changes'),
		ipAddress: varchar('ip_address', { length: 45 }),
		branchId: int('branch_id'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('audit_log_record_idx').on(table.tableName, table.recordId, table.id)]
);
