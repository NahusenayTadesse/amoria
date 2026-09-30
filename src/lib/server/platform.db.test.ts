/**
 * The pieces around the services: permissions, the catalog the shop reads, which files are public,
 * and the background job runner.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	jobLock,
	permissions,
	productImage,
	rolePermissions,
	roles,
	specialPermissions,
	user
} from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import { makeCategory, makeProduct, makeStaff, resetDb } from '$lib/server/testing/db';
import { ADMIN_ROLE, loadGrant, permissionNames, seedPermissions } from './permissions';
import { giftCategories, giftProducts } from './services/catalog';
import { isPublicFile } from './files';
import { maybeRunDueJobs } from './services/jobs/runner';
import { JOBS } from './services/jobs/registry';
import { access } from '$lib/access';

beforeEach(resetDb);

describe('permissions', () => {
	it('knows every permission a route rule needs, so none can be ungrantable', () => {
		const names = permissionNames();
		for (const rule of access.rules) {
			if (rule.permission) expect(names).toContain(rule.permission);
		}
		expect(names).toEqual([...new Set(names)].sort());
	});

	it('seeds every permission and gives the Admin role all of them, idempotently', async () => {
		const first = await seedPermissions();
		expect(first.created).toBe(permissionNames().length);
		const again = await seedPermissions();
		expect(again.created).toBe(0);
		expect(again.adminRoleId).toBe(first.adminRoleId);

		const granted = await db
			.select()
			.from(rolePermissions)
			.where(eq(rolePermissions.roleId, first.adminRoleId));
		expect(granted).toHaveLength(permissionNames().length);
	});

	it('makes an admin a super admin, and gives staff only their role’s permissions', async () => {
		const { adminRoleId } = await seedPermissions();
		const admin = await makeStaff({ role: 'admin', roleId: adminRoleId });
		expect(await loadGrant(admin)).toEqual({
			permList: expect.arrayContaining(permissionNames()),
			isSuperAdmin: true
		});

		const [clerk] = await db.insert(roles).values({ name: 'Shop clerk' }).$returningId();
		const [ordersView] = await db
			.select()
			.from(permissions)
			.where(eq(permissions.name, 'orders.view'));
		await db.insert(rolePermissions).values({ roleId: clerk.id, permissionId: ordersView.id });
		const staff = await makeStaff({ roleId: clerk.id });
		expect(await loadGrant(staff)).toEqual({ permList: ['orders.view'], isSuperAdmin: false });
	});

	it('gives a customer nothing, whatever role row they point at', async () => {
		const { adminRoleId } = await seedPermissions();
		// A customer row that somehow carries the Admin role still gets no permissions.
		const customer = await makeStaff({ role: 'customer', roleId: adminRoleId });
		expect(await loadGrant(customer)).toEqual({ permList: [], isSuperAdmin: false });
	});

	it('gives a deactivated staff member nothing', async () => {
		const { adminRoleId } = await seedPermissions();
		const leaver = await makeStaff({ role: 'admin', roleId: adminRoleId, isActive: false });
		expect(await loadGrant(leaver)).toEqual({ permList: [], isSuperAdmin: false });
	});

	it('lets special permissions replace the role’s, not add to them', async () => {
		const { adminRoleId } = await seedPermissions();
		const staff = await makeStaff({ roleId: adminRoleId });
		const [stockView] = await db
			.select()
			.from(permissions)
			.where(eq(permissions.name, 'stock.view'));
		await db.insert(specialPermissions).values({ userId: staff, permissionId: stockView.id });
		expect(await loadGrant(staff)).toEqual({ permList: ['stock.view'], isSuperAdmin: false });
	});

	it('confers nothing through a deleted role', async () => {
		const { adminRoleId } = await seedPermissions();
		const staff = await makeStaff({ roleId: adminRoleId });
		await db.update(roles).set({ deletedAt: new Date() }).where(eq(roles.name, ADMIN_ROLE));
		expect((await loadGrant(staff)).permList).toEqual([]);
		await db.update(user).set({ role: 'staff' }).where(eq(user.id, staff));
	});
});

describe('catalog', () => {
	it('shows only active, published, not-deleted gifts, featured first, with their first photo', async () => {
		const cat = await makeCategory({ kind: 'gift', name: 'Flowers' });
		const plain = await makeProduct({ categoryId: cat, name: 'Plain', sortOrder: 1 });
		const featured = await makeProduct({
			categoryId: cat,
			name: 'Featured',
			isFeatured: true,
			sortOrder: 5
		});
		await makeProduct({ categoryId: cat, name: 'Hidden', publishedAt: null });
		await makeProduct({ categoryId: cat, name: 'Off', isActive: false });
		await makeProduct({ categoryId: cat, name: 'Gone', deletedAt: new Date() });
		await makeProduct({ kind: 'rental', name: 'Tent', price: null, dailyRate: 300 });
		await db.insert(productImage).values([
			{ productId: plain, fileName: 'second.webp', sortOrder: 2 },
			{ productId: plain, fileName: 'first.webp', sortOrder: 1 },
			{ productId: plain, fileName: 'deleted.webp', sortOrder: 0, deletedAt: new Date() }
		]);
		invalidate('catalog');

		const shown = await giftProducts();
		expect(shown.map((p) => p.name)).toEqual(['Featured', 'Plain']);
		expect(shown.find((p) => p.id === plain)?.image).toBe('first.webp');
		expect(shown.find((p) => p.id === featured)?.image).toBeNull();
	});

	it('lists only gift categories that are switched on', async () => {
		await makeCategory({ kind: 'gift', name: 'Flowers', sortOrder: 2 });
		await makeCategory({ kind: 'gift', name: 'Balloons', sortOrder: 1 });
		await makeCategory({ kind: 'gift', name: 'Retired', status: false });
		await makeCategory({ kind: 'rental', name: 'Tents' });
		expect((await giftCategories()).map((c) => c.name)).toEqual(['Balloons', 'Flowers']);
	});

	it('is cached until something invalidates it', async () => {
		await makeProduct({ name: 'First' });
		expect(await giftProducts()).toHaveLength(1);
		await db.update((await import('$lib/server/db/schema')).product).set({ name: 'Renamed' });
		expect((await giftProducts())[0].name).toBe('First');
		invalidate('catalog');
		expect((await giftProducts())[0].name).toBe('Renamed');
	});
});

describe('public files', () => {
	it('serves product photos to guests, and nothing else from the store', async () => {
		const p = await makeProduct();
		await db.insert(productImage).values({ productId: p, fileName: 'photo.webp' });
		invalidate('public-images');
		expect(await isPublicFile('photo.webp')).toBe(true);
		// A transfer receipt lives in the same store; it must never be public.
		expect(await isPublicFile('receipt.png')).toBe(false);
	});

	it('stops serving a photo once it is deleted', async () => {
		const p = await makeProduct();
		await db
			.insert(productImage)
			.values({ productId: p, fileName: 'old.webp', deletedAt: new Date() });
		invalidate('public-images');
		expect(await isPublicFile('old.webp')).toBe(false);
	});
});

describe('job runner', () => {
	it('runs each due job once, and not again until it is due', async () => {
		const first = await maybeRunDueJobs();
		expect(first.map((r) => [r.name, r.ran])).toEqual(JOBS.map((j) => [j.name, true]));
		expect(first.every((r) => !r.error)).toBe(true);

		const second = await maybeRunDueJobs();
		expect(second.every((r) => !r.ran)).toBe(true);

		const locks = await db.select().from(jobLock);
		expect(locks).toHaveLength(JOBS.length);
		expect(locks.every((l) => l.lastRunAt !== null && l.lastError === null)).toBe(true);
	});

	it('lets only one of two simultaneous triggers run a job', async () => {
		const [a, b] = await Promise.all([maybeRunDueJobs(), maybeRunDueJobs()]);
		for (const job of JOBS) {
			const ran = [a, b].filter((reports) => reports.find((r) => r.name === job.name)?.ran);
			expect(ran).toHaveLength(1);
		}
	});

	it('recreates its lock rows if they have gone missing', async () => {
		await maybeRunDueJobs();
		await db.delete(jobLock);
		const reports = await maybeRunDueJobs();
		expect(reports.every((r) => r.ran)).toBe(true);
	});
});
