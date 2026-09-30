import { int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';

/**
 * Where a conversion came from, upserted from the first-touch `am_src` cookie (§5.9).
 *
 * Every column is `NOT NULL DEFAULT ''` rather than nullable: MySQL lets a unique index hold any
 * number of rows whose key has a NULL in it, so a nullable five-column key would never deduplicate
 * the common case of a visit with only `utm_source` set.
 */
export const trafficSource = mysqlTable(
	'traffic_source',
	{
		id: int('id').autoincrement().primaryKey(),
		utmSource: varchar('utm_source', { length: 100 }).notNull().default(''),
		utmMedium: varchar('utm_medium', { length: 100 }).notNull().default(''),
		utmCampaign: varchar('utm_campaign', { length: 100 }).notNull().default(''),
		utmContent: varchar('utm_content', { length: 100 }).notNull().default(''),
		refCode: varchar('ref_code', { length: 32 }).notNull().default('')
	},
	(table) => [
		uniqueIndex('traffic_source_key_idx').on(
			table.utmSource,
			table.utmMedium,
			table.utmCampaign,
			table.utmContent,
			table.refCode
		)
	]
);

/** Short links (`/l/[code]`) for ads, creators and chats (`contentCrud` + `Copy`). */
export const campaignLink = mysqlTable('campaign_link', {
	id: int('id').autoincrement().primaryKey(),
	code: varchar('code', { length: 16 }).notNull().unique(),
	label: varchar('label', { length: 120 }).notNull(),
	/** A site path such as `/decor/packages/birthday-basic`, never a full URL (no open redirect). */
	targetPath: varchar('target_path', { length: 255 }).notNull(),
	utmSource: varchar('utm_source', { length: 100 }),
	utmMedium: varchar('utm_medium', { length: 100 }),
	utmCampaign: varchar('utm_campaign', { length: 100 }),
	utmContent: varchar('utm_content', { length: 100 }),
	refCode: varchar('ref_code', { length: 32 }),
	/** Buffered in memory and added here by the `flush-link-clicks` job. */
	clicks: int('clicks').notNull().default(0),
	...secureFields
});
