/**
 * Helpers for the DB tests (`*.db.test.ts`, the `db` vitest project), which run the real services
 * against `amoria_test`. Services open their own transactions, so these tests cannot use the kit's
 * `inRollback`; instead each test starts from empty tables and builds only what it needs.
 *
 * Never imported by app code.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	bankAccount,
	category,
	course,
	courseIntake,
	deliveryArea,
	location,
	product,
	schoolShift,
	setting,
	stockBalance,
	stockLot,
	supplier,
	user
} from '$lib/server/db/schema';
import { defaultPlace, places } from '$lib/server/services/inventory/ledger';
import { invalidate } from '$lib/server/cache';
import type { Actor } from '$lib/server/services/payments/payable';

/** Every table the app writes, children before parents is not needed: FK checks are off meanwhile. */
const TABLES = [
	'audit_log',
	'pos_payment',
	'stock_movement',
	'stock_balance',
	'stock_count_line',
	'stock_count',
	'stock_document_line',
	'stock_document',
	'stock_lot',
	'requisition_line',
	'requisition',
	'purchase_order_line',
	'purchase_order',
	'pos_shift',
	'reorder_rule',
	'number_sequence',
	'payment',
	'order_item',
	'orders',
	'rental_booking_item',
	'rental_booking',
	'quote_item',
	'quote',
	'quote_request',
	'registration',
	'course_intake',
	'course_image',
	'course',
	'school_shift',
	'product_image',
	'package_image',
	'decor_package',
	'portfolio_image',
	'portfolio_item',
	'event_type',
	'product',
	'category',
	'supplier',
	'location',
	'customer',
	'delivery_area',
	'bank_account',
	'campaign_link',
	'traffic_source',
	'message',
	'setting',
	'job_lock',
	'special_permissions',
	'role_permissions',
	'permissions',
	'session',
	'account',
	'verification',
	'user',
	'roles'
];

/**
 * Empties every table and the in-memory caches, so each test starts from nothing.
 *
 * Refuses outright unless the connection is to a database named `*_test`. The app's `db` reads
 * `DATABASE_URL` through SvelteKit's `$env`, which under vitest comes from the `.env*` files — once,
 * before `.env.test` existed, that was the development database, and these tests emptied it.
 */
export async function resetDb() {
	const connection = await db.$client.getConnection();
	try {
		const [[{ name }]] = (await connection.query('SELECT DATABASE() AS name')) as unknown as [
			[{ name: string | null }]
		];
		if (!name?.endsWith('_test')) {
			throw new Error(
				`Refusing to empty "${name}": DB tests only run against a database named *_test (see .env.test).`
			);
		}
		await connection.query('SET FOREIGN_KEY_CHECKS = 0');
		for (const table of TABLES) await connection.query(`TRUNCATE TABLE \`${table}\``);
		await connection.query('SET FOREIGN_KEY_CHECKS = 1');
	} finally {
		connection.release();
	}
	for (const tag of ['settings', 'catalog', 'public-images', 'locations']) invalidate(tag);
}

/** A staff member doing something, for services that record who did it. */
export async function makeStaff(overrides: Partial<typeof user.$inferInsert> = {}) {
	const id = overrides.id ?? `staff-${Math.random().toString(36).slice(2, 10)}`;
	await db.insert(user).values({
		id,
		name: 'Test Staff',
		email: `${id}@amoria.test`,
		role: 'staff',
		...overrides
	});
	return id;
}

export function actorFor(userId: string | null): Actor {
	return { locals: { user: userId ? { id: userId } : null }, getClientAddress: () => '127.0.0.1' };
}

let seq = 0;
const next = () => ++seq;

export async function makeCategory(overrides: Partial<typeof category.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(category)
		.values({ kind: 'gift', slug: `cat-${n}`, name: `Category ${n}`, ...overrides })
		.$returningId();
	return row.id;
}

/**
 * A published, active gift with stock, unless told otherwise. The stock sits on the shop floor
 * (`where` puts it on another location), so the balances add up to `stockQty` like the real thing.
 */
export async function makeProduct(
	overrides: Partial<typeof product.$inferInsert> & { where?: number } = {}
) {
	const n = next();
	const { where, ...values } = overrides;
	const categoryId = values.categoryId ?? (await makeCategory({ kind: values.kind ?? 'gift' }));
	const [row] = await db
		.insert(product)
		.values({
			kind: 'gift',
			categoryId,
			slug: `product-${n}`,
			name: `Product ${n}`,
			price: 100,
			stockQty: 10,
			publishedAt: new Date(Date.now() - 60_000),
			...values
		})
		.$returningId();
	const qty = values.stockQty ?? 10;
	if (qty > 0) {
		const locationId = where ?? defaultPlace(await db.transaction((tx) => places(tx))).id;
		await db
			.insert(stockBalance)
			.values({ locationId, productId: row.id, lotKey: 0, quantity: qty });
	}
	invalidate('catalog');
	return row.id;
}

export async function makeDeliveryArea(overrides: Partial<typeof deliveryArea.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(deliveryArea)
		.values({ name: `Area ${n}`, fee: 150, ...overrides })
		.$returningId();
	invalidate('settings');
	return row.id;
}

export async function makeBankAccount(overrides: Partial<typeof bankAccount.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(bankAccount)
		.values({
			bankName: 'Commercial Bank of Ethiopia',
			accountName: 'Amoria Test',
			accountNumber: `1000${n.toString().padStart(9, '0')}`,
			...overrides
		})
		.$returningId();
	invalidate('settings');
	return row.id;
}

/** Sets shop settings (stored as strings, typed by `getSettings`). */
export async function setSettings(values: Record<string, string | number | boolean>) {
	for (const [key, value] of Object.entries(values)) {
		await db
			.insert(setting)
			.values({ key, value: String(value) })
			.onDuplicateKeyUpdate({ set: { value: String(value) } });
	}
	invalidate('settings');
}

/** A place stock can sit. The first one made is the shop floor's neighbour, in `sortOrder`. */
export async function makeLocation(
	overrides: Partial<typeof location.$inferInsert> = {}
): Promise<number> {
	const n = next();
	const [row] = await db
		.insert(location)
		.values({ name: `Location ${n}`, kind: 'storage', sortOrder: n, ...overrides })
		.$returningId();
	return row.id;
}

export async function makeSupplier(overrides: Partial<typeof supplier.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(supplier)
		.values({ name: `Supplier ${n}`, phone: '0911000000', ...overrides })
		.$returningId();
	return row.id;
}

/** A lot of a product, `expiresInDays` from today (negative: already expired). */
export async function makeLot(
	productId: number,
	overrides: Partial<typeof stockLot.$inferInsert> & { expiresInDays?: number } = {}
) {
	const n = next();
	const { expiresInDays, ...values } = overrides;
	const [row] = await db
		.insert(stockLot)
		.values({
			productId,
			lotNumber: `LOT-${n}`,
			expiryDate: expiresInDays === undefined ? null : dayFromNow(expiresInDays),
			...values
		})
		.$returningId();
	return row.id;
}

/** What one location holds of a product (all lots), read fresh. */
export async function balanceOf(productId: number, locationId: number, lotId?: number | null) {
	const [row] = await db
		.select({ qty: sql<number>`COALESCE(SUM(${stockBalance.quantity}), 0)` })
		.from(stockBalance)
		.where(
			sql`${stockBalance.productId} = ${productId} AND ${stockBalance.locationId} = ${locationId}${
				lotId === undefined ? sql`` : sql` AND ${stockBalance.lotKey} = ${lotId ?? 0}`
			}`
		);
	return Number(row.qty);
}

/** The current stock of a product, read fresh. */
export async function stockOf(productId: number) {
	const [row] = await db
		.select({ qty: product.stockQty })
		.from(product)
		.where(sql`${product.id} = ${productId}`);
	return row.qty;
}

/** A guest's contact details, as checkout would pass them (phone already normalised). */
export const guest = (
	overrides: Partial<{ name: string; phone: string; email: string | null }> = {}
) => ({
	name: 'Hana Tesfaye',
	phone: '+251911234567',
	email: null,
	locale: 'en' as const,
	...overrides
});

/** An active course with a fee. */
export async function makeCourse(overrides: Partial<typeof course.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(course)
		.values({ slug: `course-${n}`, title: `Course ${n}`, fee: 4500, ...overrides })
		.$returningId();
	invalidate('catalog');
	return row.id;
}

/** `days` from today, as a stored business day (`YYYY-MM-DD`). */
export function dayFromNow(days: number): string {
	return new Date(Date.now() + days * 86_400_000 + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** An open intake starting in a week, with `seatLimit` seats, unless told otherwise. */
export async function makeIntake(
	courseId: number,
	overrides: Partial<typeof courseIntake.$inferInsert> = {}
) {
	const [row] = await db
		.insert(courseIntake)
		.values({ courseId, startDate: dayFromNow(7), seatLimit: 3, ...overrides })
		.$returningId();
	invalidate('catalog');
	return row.id;
}

/** A shift classes can run in, in use unless told otherwise. */
export async function makeShift(overrides: Partial<typeof schoolShift.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(schoolShift)
		.values({ name: `Shift ${n}`, sortOrder: n, ...overrides })
		.$returningId();
	return row.id;
}
