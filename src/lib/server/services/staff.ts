import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted, deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { db } from '$lib/server/db';
import {
	account,
	permissions,
	rolePermissions,
	roles,
	session,
	specialPermissions,
	user
} from '$lib/server/db/schema';
import { ADMIN_ROLE } from '$lib/server/permissions';

/**
 * Staff accounts, roles and who may do what (§4.4), behind the admin panel. Every change is
 * audited in its own transaction, and the rules that keep the shop from locking itself out live
 * here rather than in the pages:
 *
 *   - Nobody changes their own role, access, active state or account from here: no promoting
 *     yourself, and no locking yourself out by accident.
 *   - Only a super admin may touch an Admin's account, hand out the Admin role, or change roles'
 *     permissions to ones they do not hold themselves. `staff.manage` alone is not a way up.
 *   - The last active Admin cannot be demoted, deactivated or deleted.
 *   - The Admin role always holds every permission (`seedPermissions`), so it cannot be edited,
 *     switched off or deleted.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Who is asking: the signed-in staff member and what they hold. */
export type StaffActor = {
	locals: {
		user?: { id: string } | null;
		permList?: string[];
		isSuperAdmin?: boolean;
	};
	getClientAddress: () => string;
};

const STAFF_KINDS = ['staff', 'admin'] as const;

/** A staff member (not a customer, not deleted). */
const isStaffRow = and(inArray(user.role, [...STAFF_KINDS]), notDeleted(user));

async function adminRoleId(tx: Tx | typeof db): Promise<number> {
	const [row] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, ADMIN_ROLE));
	if (!row)
		throw new WriteRefused(null, 'The Admin role is missing. Restart the app to restore it.');
	return row.id;
}

function actorId(actor: StaffActor): string {
	const id = actor.locals.user?.id;
	if (!id) throw new WriteRefused(null, 'Sign in again first.');
	return id;
}

/**
 * Active staff left holding the Admin role (and no custom permissions, which would replace it) if
 * `leaving` lost it. The shop needs at least one, or nobody could manage staff again.
 */
async function adminsBesides(tx: Tx, leaving: string): Promise<number> {
	const adminId = await adminRoleId(tx);
	const [{ total }] = await tx
		.select({ total: count() })
		.from(user)
		.where(
			and(
				isStaffRow,
				eq(user.isActive, true),
				eq(user.roleId, adminId),
				ne(user.id, leaving),
				sql`NOT EXISTS (SELECT 1 FROM special_permissions sp WHERE sp.user_id = \`user\`.\`id\` AND sp.deleted_at IS NULL)`
			)
		);
	return total;
}

/** The staff member being changed, refusing what the actor may not do to them. */
async function targetFor(tx: Tx, actor: StaffActor, id: string) {
	const [target] = await tx
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			roleId: user.roleId,
			isActive: user.isActive
		})
		.from(user)
		.where(and(eq(user.id, id), isStaffRow));
	if (!target) throw new WriteRefused(null, 'That staff account no longer exists.');
	if (target.id === actorId(actor)) {
		throw new WriteRefused(null, 'You cannot change your own account here. Ask another admin.');
	}
	if (target.roleId === (await adminRoleId(tx)) && !actor.locals.isSuperAdmin) {
		throw new WriteRefused(null, 'Only an admin can change an Admin’s account.');
	}
	return target;
}

async function guardLastAdmin(tx: Tx, target: { id: string; roleId: number | null }) {
	if (target.roleId !== (await adminRoleId(tx))) return;
	if ((await adminsBesides(tx, target.id)) === 0) {
		throw new WriteRefused(
			null,
			'This is the last active Admin. Make someone else an Admin first.'
		);
	}
}

/** A role that exists, is switched on, and the actor may hand out. */
async function assignableRole(tx: Tx, actor: StaffActor, roleId: number) {
	const [role] = await tx
		.select({ id: roles.id, name: roles.name })
		.from(roles)
		.where(and(eq(roles.id, roleId), eq(roles.isActive, true), notDeleted(roles)));
	if (!role) throw new WriteRefused(null, 'Choose a role that is switched on.');
	if (role.name === ADMIN_ROLE && !actor.locals.isSuperAdmin) {
		throw new WriteRefused(null, 'Only an admin can make someone an Admin.');
	}
	return role;
}

/**
 * The permission ids, checked: each must exist, and someone short of super admin may only grant
 * what they hold themselves.
 */
async function grantable(tx: Tx, actor: StaffActor, ids: number[]): Promise<number[]> {
	const wanted = [...new Set(ids)];
	if (!wanted.length) return [];
	const rows = await tx
		.select({ id: permissions.id, name: permissions.name })
		.from(permissions)
		.where(inArray(permissions.id, wanted));
	if (rows.length !== wanted.length)
		throw new WriteRefused(null, 'Reload the page: the list changed.');
	if (!actor.locals.isSuperAdmin) {
		const held = new Set(actor.locals.permList ?? []);
		const beyond = rows.filter((p) => !held.has(p.name)).map((p) => p.name);
		if (beyond.length) {
			throw new WriteRefused(
				null,
				`You can only give permissions you have yourself. Not yours: ${beyond.join(', ')}.`
			);
		}
	}
	return wanted;
}

/** Signs someone out everywhere, so a new password or a lost job takes effect at once. */
async function signOutEverywhere(tx: Tx, userId: string) {
	await tx.delete(session).where(eq(session.userId, userId));
}

async function emailTaken(tx: Tx, email: string, except?: string) {
	const [row] = await tx
		.select({ id: user.id, role: user.role })
		.from(user)
		.where(and(eq(user.email, email), except ? ne(user.id, except) : undefined));
	if (!row) return;
	throw new WriteRefused(
		null,
		row.role === 'customer'
			? 'That email belongs to a customer account. Use another email for the staff account.'
			: 'Another account already uses that email.'
	);
}

// ---------------------------------------------------------------- reads

export async function listStaff() {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			kind: user.role,
			isActive: user.isActive,
			createdAt: user.createdAt,
			roleId: user.roleId,
			roleName: roles.name,
			customPermissions: sql<number>`(SELECT COUNT(*) FROM special_permissions sp WHERE sp.user_id = \`user\`.\`id\` AND sp.deleted_at IS NULL)`
		})
		.from(user)
		.leftJoin(roles, eq(roles.id, user.roleId))
		.where(isStaffRow)
		.orderBy(asc(user.name));
	return rows.map((row) => ({ ...row, customPermissions: Number(row.customPermissions) }));
}

export type StaffRow = Awaited<ReturnType<typeof listStaff>>[number];

export async function getStaff(id: string) {
	const [row] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			kind: user.role,
			isActive: user.isActive,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			roleId: user.roleId,
			roleName: roles.name,
			roleActive: roles.isActive
		})
		.from(user)
		.leftJoin(roles, eq(roles.id, user.roleId))
		.where(and(eq(user.id, id), isStaffRow));
	if (!row) return null;

	const [rolePerms, custom, [lastSeen]] = await Promise.all([
		row.roleId ? permissionIdsOfRole(row.roleId) : Promise.resolve([]),
		db
			.select({ id: specialPermissions.permissionId })
			.from(specialPermissions)
			.where(and(eq(specialPermissions.userId, id), notDeleted(specialPermissions)))
			.then((list) => list.map((p) => p.id)),
		db
			.select({ at: sql<Date | null>`MAX(${session.updatedAt})` })
			.from(session)
			.where(eq(session.userId, id))
	]);
	return {
		...row,
		rolePermissionIds: rolePerms,
		customPermissionIds: custom,
		lastSeen: lastSeen?.at
	};
}

/** Every permission, for the checklists, in a stable order. */
export function allPermissions() {
	return db
		.select({ id: permissions.id, name: permissions.name, description: permissions.description })
		.from(permissions)
		.orderBy(asc(permissions.name));
}

export type PermissionRow = Awaited<ReturnType<typeof allPermissions>>[number];

async function permissionIdsOfRole(roleId: number) {
	const rows = await db
		.select({ id: rolePermissions.permissionId })
		.from(rolePermissions)
		.where(and(eq(rolePermissions.roleId, roleId), notDeleted(rolePermissions)));
	return [...new Set(rows.map((r) => r.id))];
}

export async function listRoles() {
	const rows = await db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			isActive: roles.isActive,
			staff: sql<number>`(SELECT COUNT(*) FROM user u WHERE u.role_id = \`roles\`.\`id\` AND u.deleted_at IS NULL AND u.role IN ('staff', 'admin'))`,
			permissions: sql<number>`(SELECT COUNT(DISTINCT rp.permission_id) FROM role_permissions rp WHERE rp.role_id = \`roles\`.\`id\` AND rp.deleted_at IS NULL)`
		})
		.from(roles)
		.where(notDeleted(roles))
		.orderBy(asc(roles.name));
	return rows.map((row) => ({
		...row,
		staff: Number(row.staff),
		permissions: Number(row.permissions),
		isAdmin: row.name === ADMIN_ROLE
	}));
}

export type RoleRow = Awaited<ReturnType<typeof listRoles>>[number];

/** Roles to pick from when adding or editing staff. */
export async function roleChoices() {
	const rows = await db
		.select({ value: roles.id, name: roles.name })
		.from(roles)
		.where(and(eq(roles.isActive, true), notDeleted(roles)))
		.orderBy(asc(roles.name));
	return rows;
}

export async function getRole(id: number) {
	const [role] = await db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			isActive: roles.isActive
		})
		.from(roles)
		.where(and(eq(roles.id, id), notDeleted(roles)));
	if (!role) return null;
	const [permissionIds, members] = await Promise.all([
		permissionIdsOfRole(id),
		db
			.select({ id: user.id, name: user.name, email: user.email, isActive: user.isActive })
			.from(user)
			.where(and(eq(user.roleId, id), isStaffRow))
			.orderBy(asc(user.name))
	]);
	return { ...role, isAdmin: role.name === ADMIN_ROLE, permissionIds, members };
}

// ---------------------------------------------------------------- staff writes

export async function createStaff(
	actor: StaffActor,
	input: { name: string; email: string; phone: string; roleId: number; password: string }
): Promise<string> {
	actorId(actor);
	const hash = await hashPassword(input.password);
	return db.transaction(async (tx) => {
		await emailTaken(tx, input.email);
		const role = await assignableRole(tx, actor, input.roleId);
		// better-auth's own id shape and credential row, written here so the account, its role and
		// the audit entry land together. `auth.api.signUpEmail` would sign the admin in as them.
		const id = randomBytes(16).toString('hex');
		await tx.insert(user).values({
			id,
			name: input.name,
			email: input.email,
			emailVerified: true,
			role: 'staff',
			roleId: role.id,
			phone: normalizePhone(input.phone)
		});
		await tx.insert(account).values({
			id: randomBytes(16).toString('hex'),
			accountId: id,
			providerId: 'credential',
			userId: id,
			password: hash
		});
		await recordAudit(tx, actor, {
			table: 'user',
			recordId: id,
			action: 'create',
			detail: { role: role.name }
		});
		return id;
	});
}

export async function updateStaff(
	actor: StaffActor,
	id: string,
	input: { name: string; email: string; phone: string; roleId: number }
) {
	await db.transaction(async (tx) => {
		const target = await targetFor(tx, actor, id);
		await emailTaken(tx, input.email, id);
		if (input.roleId !== target.roleId) {
			await assignableRole(tx, actor, input.roleId);
			await guardLastAdmin(tx, target);
		}
		const after = {
			name: input.name,
			email: input.email,
			phone: normalizePhone(input.phone),
			roleId: input.roleId
		};
		await tx.update(user).set(after).where(eq(user.id, id));
		// A new email is a new sign-in name: their open sessions were made under the old one.
		if (after.email !== target.email) await signOutEverywhere(tx, id);
		await recordAudit(tx, actor, {
			table: 'user',
			recordId: id,
			action: 'update',
			before: target,
			after
		});
	});
}

export async function setStaffActive(actor: StaffActor, id: string, isActive: boolean) {
	await db.transaction(async (tx) => {
		const target = await targetFor(tx, actor, id);
		if (target.isActive === isActive) return;
		if (!isActive) {
			await guardLastAdmin(tx, target);
			await signOutEverywhere(tx, id);
		}
		await tx.update(user).set({ isActive }).where(eq(user.id, id));
		await recordAudit(tx, actor, {
			table: 'user',
			recordId: id,
			action: 'update',
			before: { isActive: target.isActive },
			after: { isActive }
		});
	});
}

export async function resetStaffPassword(actor: StaffActor, id: string, password: string) {
	const hash = await hashPassword(password);
	await db.transaction(async (tx) => {
		await targetFor(tx, actor, id);
		const [credential] = await tx
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, id), eq(account.providerId, 'credential')));
		if (credential) {
			await tx.update(account).set({ password: hash }).where(eq(account.id, credential.id));
		} else {
			await tx.insert(account).values({
				id: randomBytes(16).toString('hex'),
				accountId: id,
				providerId: 'credential',
				userId: id,
				password: hash
			});
		}
		await signOutEverywhere(tx, id);
		await recordAudit(tx, actor, {
			table: 'user',
			recordId: id,
			action: 'update',
			detail: { password: 'reset' }
		});
	});
}

/**
 * Removes a staff account from the list for good (super admins only). The row stays, soft
 * deleted, because records they created point at it; the email stays taken for the same reason.
 */
export async function deleteStaff(actor: StaffActor, id: string) {
	if (!actor.locals.isSuperAdmin) throw new WriteRefused(null, 'Only an admin can delete staff.');
	await db.transaction(async (tx) => {
		const target = await targetFor(tx, actor, id);
		if (target.isActive) await guardLastAdmin(tx, target);
		await signOutEverywhere(tx, id);
		await tx
			.update(user)
			.set({ isActive: false, ...deletionStamp(actorId(actor)) })
			.where(eq(user.id, id));
		await recordAudit(tx, actor, { table: 'user', recordId: id, action: 'delete' });
	});
}

/**
 * Brings a link table's live rows for one owner to exactly `wanted`: revives soft-deleted rows
 * before inserting, so the unique index on `special_permissions` never trips.
 */
async function syncLinks(
	tx: Tx,
	actor: StaffActor,
	table: typeof rolePermissions | typeof specialPermissions,
	ownerWhere: ReturnType<typeof eq>,
	newRow: (permissionId: number) => Record<string, unknown>,
	wanted: number[]
) {
	const who = actorId(actor);
	const existing = await tx
		.select({ id: table.id, permissionId: table.permissionId, deletedAt: table.deletedAt })
		.from(table)
		.where(ownerWhere);
	const live = new Set(existing.filter((r) => !r.deletedAt).map((r) => r.permissionId));
	const added = wanted.filter((p) => !live.has(p));
	const removed = [...live].filter((p) => !wanted.includes(p));

	if (removed.length) {
		await tx
			.update(table)
			.set({ ...deletionStamp(who), updatedBy: who })
			.where(and(ownerWhere, inArray(table.permissionId, removed), isNull(table.deletedAt)));
	}
	for (const permissionId of added) {
		const dead = existing.find((r) => r.permissionId === permissionId && r.deletedAt);
		if (dead) {
			await tx
				.update(table)
				.set({ deletedAt: null, deletedBy: null, updatedBy: who })
				.where(eq(table.id, dead.id));
		} else {
			await tx
				.insert(table)
				.values({ ...newRow(permissionId), createdBy: who } as typeof table.$inferInsert);
		}
	}
	return { added, removed };
}

async function namesOf(tx: Tx, ids: number[]) {
	if (!ids.length) return [];
	const rows = await tx
		.select({ name: permissions.name })
		.from(permissions)
		.where(inArray(permissions.id, ids));
	return rows.map((r) => r.name).sort();
}

/**
 * One person's own permissions, which replace their role's while they have any (`loadGrant`).
 * An empty list puts them back on their role's.
 */
export async function setCustomPermissions(actor: StaffActor, id: string, permissionIds: number[]) {
	await db.transaction(async (tx) => {
		const target = await targetFor(tx, actor, id);
		const wanted = await grantable(tx, actor, permissionIds);
		// Custom permissions replace the role's, so an Admin given any stops being one.
		if (wanted.length) await guardLastAdmin(tx, target);
		const { added, removed } = await syncLinks(
			tx,
			actor,
			specialPermissions,
			eq(specialPermissions.userId, id),
			(permissionId) => ({ userId: id, permissionId }),
			wanted
		);
		if (!added.length && !removed.length) return;
		await recordAudit(tx, actor, {
			table: 'special_permissions',
			recordId: id,
			action: 'update',
			detail: { added: await namesOf(tx, added), removed: await namesOf(tx, removed) }
		});
	});
}

// ---------------------------------------------------------------- role writes

async function editableRole(tx: Tx, id: number) {
	const [role] = await tx
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			isActive: roles.isActive
		})
		.from(roles)
		.where(and(eq(roles.id, id), notDeleted(roles)));
	if (!role) throw new WriteRefused(null, 'That role no longer exists.');
	if (role.name === ADMIN_ROLE) {
		throw new WriteRefused(
			null,
			'The Admin role always has every permission and cannot be changed.'
		);
	}
	return role;
}

async function nameTaken(tx: Tx, name: string, except?: number) {
	const [row] = await tx
		.select({ id: roles.id, deletedAt: roles.deletedAt })
		.from(roles)
		.where(
			and(
				sql`LOWER(${roles.name}) = ${name.toLowerCase()}`,
				except ? ne(roles.id, except) : undefined
			)
		);
	if (!row) return;
	throw new WriteRefused(
		null,
		row.deletedAt
			? 'A deleted role had that name. Choose another.'
			: 'There is already a role with that name.'
	);
}

export async function createRole(
	actor: StaffActor,
	input: { name: string; description: string },
	permissionIds: number[]
): Promise<number> {
	actorId(actor);
	return db.transaction(async (tx) => {
		if (input.name.toLowerCase() === ADMIN_ROLE.toLowerCase()) {
			throw new WriteRefused(null, 'There is already a role with that name.');
		}
		await nameTaken(tx, input.name);
		const wanted = await grantable(tx, actor, permissionIds);
		const [{ id }] = await tx
			.insert(roles)
			.values({ name: input.name, description: input.description || null })
			.$returningId();
		await syncLinks(
			tx,
			actor,
			rolePermissions,
			eq(rolePermissions.roleId, id),
			(permissionId) => ({ roleId: id, permissionId }),
			wanted
		);
		await recordAudit(tx, actor, {
			table: 'roles',
			recordId: id,
			action: 'create',
			detail: { permissions: await namesOf(tx, wanted) }
		});
		return id;
	});
}

export async function updateRole(
	actor: StaffActor,
	id: number,
	input: { name: string; description: string; isActive: boolean }
) {
	actorId(actor);
	await db.transaction(async (tx) => {
		const before = await editableRole(tx, id);
		if (input.name.toLowerCase() === ADMIN_ROLE.toLowerCase()) {
			throw new WriteRefused(null, 'There is already a role with that name.');
		}
		await nameTaken(tx, input.name, id);
		const after = {
			name: input.name,
			description: input.description || null,
			isActive: input.isActive
		};
		await tx.update(roles).set(after).where(eq(roles.id, id));
		await recordAudit(tx, actor, { table: 'roles', recordId: id, action: 'update', before, after });
	});
}

export async function setRolePermissions(actor: StaffActor, id: number, permissionIds: number[]) {
	await db.transaction(async (tx) => {
		await editableRole(tx, id);
		const wanted = await grantable(tx, actor, permissionIds);
		// Taking away what the actor does not hold is a way of changing what others may do too.
		if (!actor.locals.isSuperAdmin) {
			const current = await tx
				.select({ permissionId: rolePermissions.permissionId })
				.from(rolePermissions)
				.where(and(eq(rolePermissions.roleId, id), notDeleted(rolePermissions)));
			const dropped = current.map((r) => r.permissionId).filter((p) => !wanted.includes(p));
			await grantable(tx, actor, dropped);
		}
		const { added, removed } = await syncLinks(
			tx,
			actor,
			rolePermissions,
			eq(rolePermissions.roleId, id),
			(permissionId) => ({ roleId: id, permissionId }),
			wanted
		);
		if (!added.length && !removed.length) return;
		await recordAudit(tx, actor, {
			table: 'role_permissions',
			recordId: id,
			action: 'update',
			detail: { added: await namesOf(tx, added), removed: await namesOf(tx, removed) }
		});
	});
}

/** Super admins only, and only a role nobody holds. Its permission links go with it. */
export async function deleteRole(actor: StaffActor, id: number) {
	if (!actor.locals.isSuperAdmin) throw new WriteRefused(null, 'Only an admin can delete a role.');
	const who = actorId(actor);
	await db.transaction(async (tx) => {
		await editableRole(tx, id);
		const [{ holders }] = await tx
			.select({ holders: count() })
			.from(user)
			.where(and(eq(user.roleId, id), notInArray(user.role, ['customer']), notDeleted(user)));
		if (holders) {
			throw new WriteRefused(
				null,
				`${holders === 1 ? 'One person has' : `${holders} people have`} this role. Give them another role first.`
			);
		}
		await tx
			.update(rolePermissions)
			.set(deletionStamp(who))
			.where(and(eq(rolePermissions.roleId, id), isNull(rolePermissions.deletedAt)));
		await tx
			.update(roles)
			.set({ isActive: false, ...deletionStamp(who) })
			.where(eq(roles.id, id));
		await recordAudit(tx, actor, { table: 'roles', recordId: id, action: 'delete' });
	});
}
