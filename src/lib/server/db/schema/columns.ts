/**
 * Column sets repeated across Amoria's own tables. The kit's mixins (`secureFields.ts`) cover
 * content; these cover what the transactional records share: money, public references, the contact
 * snapshot and plain timestamps.
 *
 * Each is a function, not a shared object, so every table gets its own column builders.
 */
import { customType, decimal, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/** Birr, `decimal(12,2)` read as a number (§5.0). Round with `roundBirr` before writing. */
export const birr = (name: string) => decimal(name, { precision: 12, scale: 2, mode: 'number' });

/**
 * JSON kept in a LONGTEXT column, for opaque values only — never queried into (§3.1).
 *
 * MariaDB's own `JSON` type is LONGTEXT plus a `CHECK (json_valid(...))`, and drizzle-kit cannot
 * introspect MariaDB check constraints (stock management hit this: `db:push` exits with no
 * message). Same storage, no constraint; the value goes in and comes out as an object.
 */
export const jsonText = customType<{ data: unknown; driverData: string | null }>({
	dataType: () => 'longtext',
	toDriver: (value) => (value === null || value === undefined ? null : JSON.stringify(value)),
	fromDriver: (value) => {
		if (value === null) return null;
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	}
});

/**
 * `createdAt`/`updatedAt` for transactional records, which are never deleted and so take no
 * `secureFields` (§5.0). Defined the way the kit's `secureFields` defines them.
 */
export const timestamps = () => ({
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull()
});

/**
 * The human number and the link token of a record a customer pays for (§5.0).
 *
 * `ref` is nullable because it is formatted from the id, which exists only after the insert
 * (`insertReturningId`, then `AM-O-000123`). `publicToken` is 128 random bits in base64url
 * (22 characters) and is the only way the record is addressed publicly.
 */
export const publicRecord = () => ({
	ref: varchar('ref', { length: 20 }).unique(),
	publicToken: varchar('public_token', { length: 32 }).notNull().unique()
});

/** What the customer typed, copied onto the record at the time (§5.0 snapshots). */
export const contactSnapshot = () => ({
	contactName: varchar('contact_name', { length: 120 }).notNull(),
	contactPhone: varchar('contact_phone', { length: 20 }).notNull(),
	contactEmail: varchar('contact_email', { length: 190 })
});
