import { eq, sql } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { customer } from '$lib/server/db/schema';

export type GuestDetails = {
	name: string;
	/** Already normalised by `normalizePhone`. */
	phone: string;
	email: string | null;
	locale: 'en' | 'am';
};

/**
 * The `customer` row for a guest checkout, created on first sight of the phone number (§5.1).
 *
 * An existing row is **never updated** from checkout input: what was typed is unverified, and the
 * record being created keeps its own contact snapshot anyway. Overwriting would let anyone who
 * knows a customer's number rename them.
 *
 * `INSERT … ON DUPLICATE KEY UPDATE id = id` rather than select-then-insert, so two first orders
 * from the same phone at once cannot both insert and one fail on the unique key.
 */
export async function upsertGuest(tx: Writer, details: GuestDetails): Promise<number> {
	await tx
		.insert(customer)
		.values({
			name: details.name,
			phone: details.phone,
			email: details.email,
			locale: details.locale
		})
		.onDuplicateKeyUpdate({ set: { id: sql`id` } });

	const [row] = await tx
		.select({ id: customer.id })
		.from(customer)
		.where(eq(customer.phone, details.phone));

	return row.id;
}
