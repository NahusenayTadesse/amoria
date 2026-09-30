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
	product,
	setting,
	user
} from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import type { Actor } from '$lib/server/services/payments/payable';

/** Every table the app writes, children before parents is not needed: FK checks are off meanwhile. */
const TABLES = [
	'audit_log',
	'stock_movement',
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
	'product_image',
	'package_image',
	'decor_package',
	'portfolio_image',
	'portfolio_item',
	'event_type',
	'product',
	'category',
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
	for (const tag of ['settings', 'catalog', 'public-images']) invalidate(tag);
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

/** A published, active gift with stock, unless told otherwise. */
export async function makeProduct(overrides: Partial<typeof product.$inferInsert> = {}) {
	const n = next();
	const categoryId =
		overrides.categoryId ?? (await makeCategory({ kind: overrides.kind ?? 'gift' }));
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
			...overrides
		})
		.$returningId();
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
