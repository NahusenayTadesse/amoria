import { and, count, eq, inArray, notInArray } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import {
	permissions,
	rolePermissions,
	roles,
	specialPermissions,
	user
} from '$lib/server/db/schema';
import { access } from '$lib/access';

/**
 * Staff permissions (§4.4), the stock-management model carried over without organisations.
 *
 * Every permission is either a route rule in `$lib/access` or listed here as enforced in code
 * (an action that needs more than the page's own gate), so a gated route cannot ship with a
 * permission nobody can be granted.
 */
const CODE_ONLY_PERMISSIONS = [
	'orders.manage',
	'payments.record',
	'requisitions.approve',
	'pos.discount',
	'staff.manage'
] as const;

/** Wording for the permission checklist on the roles screen. */
export const DESCRIPTIONS: Record<string, string> = {
	'orders.view': 'See orders, their payments and receipts',
	'orders.manage': 'Move orders along (preparing, ready, completed) and cancel them',
	'payments.record': 'Confirm or reject transfer receipts, and record cash payments',
	'catalog.manage': 'Add and change products, their photos, prices and categories',
	'school.manage': 'Add and change courses, intakes and photos, and handle student registrations',
	'stock.view': 'See stock levels, the stock ledger and what is expiring',
	'stock.adjust':
		'Record deliveries, issues, transfers, returns, damage and losses, and post stock counts',
	'stock.count':
		'Open stock counts and enter what was counted (expected quantities stay hidden on blind counts)',
	'purchasing.manage': 'Manage suppliers, purchase orders and reorder planning',
	'requisitions.request': 'Ask the store for materials, and see requisitions',
	'requisitions.approve': 'Approve or reject a requisition, cutting quantities if need be',
	'pos.sell': 'Use the till: open a shift, sell, take returns and close the drawer',
	'pos.discount': 'Sell below the shelf price at the till',
	'reports.view': 'See stock, sales and VAT reports',
	'data.import': 'Import products, suppliers and opening stock from a spreadsheet',
	'settings.manage': 'Change delivery areas, bank accounts and shop settings',
	'staff.manage': 'Create staff accounts and decide what roles may do'
};

/** The role every permission is granted to on each boot. Seeded; cannot lose a permission. */
export const ADMIN_ROLE = 'Admin';

/** Every permission the system recognises, in a stable order. */
export function permissionNames(): string[] {
	const fromRoutes = access.rules
		.map((rule) => rule.permission)
		.filter((name): name is string => name !== null);
	return [...new Set([...fromRoutes, ...CODE_ONLY_PERMISSIONS])].sort();
}

/**
 * Brings `permissions` in step with the code and gives the Admin role all of them. Idempotent and
 * additive: inserts what is missing, removes nothing. Run once per boot from `hooks.server.ts`.
 */
export async function seedPermissions(): Promise<{ created: number; adminRoleId: number }> {
	const names = permissionNames();

	const existing = await db.select({ name: permissions.name }).from(permissions);
	const have = new Set(existing.map((p) => p.name));
	const missing = names.filter((name) => !have.has(name));
	if (missing.length) {
		await db
			.insert(permissions)
			.values(missing.map((name) => ({ name, description: DESCRIPTIONS[name] ?? null })));
	}

	await db.insert(roles).ignore().values({ name: ADMIN_ROLE, description: 'Everything, always' });
	const [admin] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, ADMIN_ROLE));

	const granted = await db
		.select({ permissionId: rolePermissions.permissionId })
		.from(rolePermissions)
		.where(and(eq(rolePermissions.roleId, admin.id), notDeleted(rolePermissions)));
	const all = await db.select({ id: permissions.id }).from(permissions);
	const toGrant = all.map((p) => p.id).filter((id) => !granted.some((g) => g.permissionId === id));
	if (toGrant.length) {
		await db
			.insert(rolePermissions)
			.values(toGrant.map((permissionId) => ({ roleId: admin.id, permissionId })));
	}

	return { created: missing.length, adminRoleId: admin.id };
}

/**
 * What a signed-in staff member may do (dentalClinic's rule): their role's permissions, unless they
 * have special permissions of their own, which then replace the role's. A deleted or inactive role,
 * or a deleted grant, confers nothing. Customers get nothing — the dashboard is for staff.
 */
export async function loadGrant(
	userId: string
): Promise<{ permList: string[]; isSuperAdmin: boolean }> {
	const [rolePerms, specialPerms] = await Promise.all([
		db
			.select({ name: permissions.name })
			.from(user)
			.innerJoin(roles, and(eq(user.roleId, roles.id), eq(roles.isActive, true), notDeleted(roles)))
			.innerJoin(
				rolePermissions,
				and(eq(roles.id, rolePermissions.roleId), notDeleted(rolePermissions))
			)
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(
				and(
					eq(user.id, userId),
					inArray(user.role, ['staff', 'admin']),
					eq(user.isActive, true),
					notDeleted(user)
				)
			),
		db
			.select({ name: permissions.name })
			.from(specialPermissions)
			.innerJoin(permissions, eq(specialPermissions.permissionId, permissions.id))
			.innerJoin(user, eq(user.id, specialPermissions.userId))
			.where(
				and(
					eq(specialPermissions.userId, userId),
					notInArray(user.role, ['customer']),
					notDeleted(specialPermissions)
				)
			)
	]);

	const permList = (specialPerms.length ? specialPerms : rolePerms).map((p) => p.name);
	return { permList, isSuperAdmin: await computeIsSuperAdmin(permList) };
}

/** A super admin holds every permission in the table (an empty table makes nobody one). */
export async function computeIsSuperAdmin(permList: string[]): Promise<boolean> {
	if (!permList.length) return false;
	const [{ total }] = await db.select({ total: count() }).from(permissions);
	if (!total) return false;
	return new Set(permList).size === total;
}
