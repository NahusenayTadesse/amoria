/**
 * The admin panel's rules: who may add, change, switch off and delete staff, and hand out roles
 * and permissions, without anyone promoting or locking themselves out.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import { db } from '$lib/server/db';
import {
	account,
	auditLog,
	permissions,
	roles,
	session,
	specialPermissions,
	user
} from '$lib/server/db/schema';
import { makeStaff, resetDb } from '$lib/server/testing/db';
import { loadGrant, permissionNames, seedPermissions } from '$lib/server/permissions';
import {
	createRole,
	createStaff,
	deleteRole,
	deleteStaff,
	getStaff,
	listRoles,
	listStaff,
	resetStaffPassword,
	setCustomPermissions,
	setRolePermissions,
	setStaffActive,
	updateRole,
	updateStaff,
	type StaffActor
} from './staff';

beforeEach(resetDb);

const PASSWORD = 'correct horse battery';

/** Someone acting with exactly what `loadGrant` gives them, as the hooks would. */
async function actorOf(userId: string): Promise<StaffActor> {
	const grant = await loadGrant(userId);
	return {
		locals: { user: { id: userId }, ...grant },
		getClientAddress: () => '127.0.0.1'
	};
}

async function permissionIds(...names: string[]) {
	const rows = await db.select().from(permissions);
	return names.map((name) => rows.find((p) => p.name === name)!.id);
}

/** An admin, and a manager who holds only `staff.manage` and `orders.view` through a role. */
async function setup() {
	const { adminRoleId } = await seedPermissions();
	const admin = await makeStaff({ role: 'admin', roleId: adminRoleId, name: 'Admin' });
	const adminActor = await actorOf(admin);
	const managerRole = await createRole(adminActor, { name: 'Manager', description: '' }, []);
	await setRolePermissions(
		adminActor,
		managerRole,
		await permissionIds('staff.manage', 'orders.view')
	);
	const clerkRole = await createRole(adminActor, { name: 'Clerk', description: '' }, []);
	const manager = await makeStaff({ roleId: managerRole, name: 'Manager' });
	return { adminRoleId, admin, adminActor, managerRole, clerkRole, manager };
}

describe('adding staff', () => {
	it('creates a staff account with its role and a password they can sign in with', async () => {
		const { adminActor, clerkRole } = await setup();
		const id = await createStaff(adminActor, {
			name: 'Hana',
			email: 'hana@amoria.test',
			phone: '0911234567',
			roleId: clerkRole,
			password: PASSWORD
		});

		const [row] = await db.select().from(user).where(eq(user.id, id));
		expect(row).toMatchObject({ role: 'staff', roleId: clerkRole, phone: '+251911234567' });
		const [credential] = await db
			.select()
			.from(account)
			.where(and(eq(account.userId, id), eq(account.providerId, 'credential')));
		expect(await verifyPassword({ hash: credential.password!, password: PASSWORD })).toBe(true);
		const audits = await db.select().from(auditLog).where(eq(auditLog.recordId, id));
		expect(audits.map((a) => a.action)).toEqual(['create']);
		expect((await listStaff()).map((s) => s.name)).toContain('Hana');
	});

	it('refuses an email a customer account already uses', async () => {
		const { adminActor, clerkRole } = await setup();
		await makeStaff({ role: 'customer', email: 'buyer@amoria.test' });
		await expect(
			createStaff(adminActor, {
				name: 'Buyer',
				email: 'buyer@amoria.test',
				phone: '',
				roleId: clerkRole,
				password: PASSWORD
			})
		).rejects.toThrow(/customer account/);
	});

	it('lets only a super admin make someone an Admin', async () => {
		const { adminRoleId, manager } = await setup();
		await expect(
			createStaff(await actorOf(manager), {
				name: 'Sneaky',
				email: 'sneaky@amoria.test',
				phone: '',
				roleId: adminRoleId,
				password: PASSWORD
			})
		).rejects.toThrow(/Only an admin/);
	});
});

describe('changing staff', () => {
	it('never lets someone change their own account', async () => {
		const { admin, adminActor, clerkRole } = await setup();
		await expect(setStaffActive(adminActor, admin, false)).rejects.toThrow(/your own account/);
		await expect(
			updateStaff(adminActor, admin, {
				name: 'Admin',
				email: 'x@amoria.test',
				phone: '',
				roleId: clerkRole
			})
		).rejects.toThrow(/your own account/);
		await expect(setCustomPermissions(adminActor, admin, [])).rejects.toThrow(/your own account/);
	});

	it('keeps a manager from touching an Admin, or from granting what they lack', async () => {
		const { admin, manager, clerkRole } = await setup();
		const managerActor = await actorOf(manager);
		await expect(setStaffActive(managerActor, admin, false)).rejects.toThrow(/Admin’s account/);

		const clerk = await makeStaff({ roleId: clerkRole });
		await expect(
			setCustomPermissions(managerActor, clerk, await permissionIds('stock.adjust'))
		).rejects.toThrow(/stock.adjust/);
		await setCustomPermissions(managerActor, clerk, await permissionIds('orders.view'));
		expect((await loadGrant(clerk)).permList).toEqual(['orders.view']);
	});

	it('keeps the last active Admin, and signs out whoever is switched off', async () => {
		const { adminRoleId, admin, adminActor, clerkRole } = await setup();
		const second = await makeStaff({ roleId: adminRoleId, name: 'Second admin' });
		const secondActor = await actorOf(second);

		// Two admins: one may switch the other off, and their sessions go.
		await db.insert(session).values({
			id: 's1',
			token: 't1',
			userId: second,
			expiresAt: new Date(Date.now() + 86_400_000)
		});
		await setStaffActive(adminActor, second, false);
		expect(await db.select().from(session).where(eq(session.userId, second))).toHaveLength(0);
		expect((await loadGrant(second)).permList).toEqual([]);

		// Back on, then the second tries to demote the first: fine while two remain...
		await setStaffActive(adminActor, second, true);
		await setStaffActive(secondActor, admin, false);
		// ...but now `second` is the only active Admin and nobody else can switch them off.
		await setStaffActive(secondActor, admin, true);
		await updateStaff(secondActor, admin, {
			name: 'Admin',
			email: 'admin@amoria.test',
			phone: '',
			roleId: clerkRole
		});
		const newAdmin = await actorOf(admin);
		expect(newAdmin.locals.isSuperAdmin).toBe(false);
		// Giving the last Admin custom permissions would replace the Admin role's, so it is refused.
		const third = await makeStaff({ roleId: adminRoleId });
		await expect(setCustomPermissions(await actorOf(third), second, [])).resolves.toBeUndefined();
		await setStaffActive(await actorOf(third), second, false);
		await expect(
			setCustomPermissions(secondActor, third, await permissionIds('orders.view'))
		).rejects.toThrow(/last active Admin/);
	});

	it('gives someone their own permissions, takes them back, and gives them again', async () => {
		const { adminActor, clerkRole } = await setup();
		const clerk = await makeStaff({ roleId: clerkRole });
		const [ordersView, stockView] = await permissionIds('orders.view', 'stock.view');

		await setCustomPermissions(adminActor, clerk, [ordersView, stockView]);
		await setCustomPermissions(adminActor, clerk, []);
		expect((await loadGrant(clerk)).permList).toEqual([]);
		// The rows are soft deleted; giving them again must revive them, not trip the unique index.
		await setCustomPermissions(adminActor, clerk, [stockView]);
		expect((await loadGrant(clerk)).permList).toEqual(['stock.view']);
		expect(await db.select().from(specialPermissions)).toHaveLength(2);
		expect((await getStaff(clerk))?.customPermissionIds).toEqual([stockView]);
	});

	it('sets a new password and signs them out everywhere', async () => {
		const { adminActor, clerkRole } = await setup();
		const clerk = await createStaff(adminActor, {
			name: 'Clerk',
			email: 'clerk@amoria.test',
			phone: '',
			roleId: clerkRole,
			password: PASSWORD
		});
		await db.insert(session).values({
			id: 's2',
			token: 't2',
			userId: clerk,
			expiresAt: new Date(Date.now() + 86_400_000)
		});
		await resetStaffPassword(adminActor, clerk, 'a brand new password');
		const [credential] = await db.select().from(account).where(eq(account.userId, clerk));
		expect(
			await verifyPassword({ hash: credential.password!, password: 'a brand new password' })
		).toBe(true);
		expect(await db.select().from(session).where(eq(session.userId, clerk))).toHaveLength(0);
	});

	it('lets only a super admin delete staff, and hides them afterwards', async () => {
		const { adminActor, manager, clerkRole } = await setup();
		const clerk = await makeStaff({ roleId: clerkRole, name: 'Leaver' });
		await expect(deleteStaff(await actorOf(manager), clerk)).rejects.toThrow(/Only an admin/);
		await deleteStaff(adminActor, clerk);
		expect((await listStaff()).map((s) => s.name)).not.toContain('Leaver');
		expect(await getStaff(clerk)).toBeNull();
		expect((await loadGrant(clerk)).permList).toEqual([]);
	});
});

describe('roles', () => {
	it('gives everyone with a role its permissions as soon as they are saved', async () => {
		const { adminActor, clerkRole } = await setup();
		const clerk = await makeStaff({ roleId: clerkRole });
		await setRolePermissions(adminActor, clerkRole, await permissionIds('pos.sell', 'stock.view'));
		expect((await loadGrant(clerk)).permList.sort()).toEqual(['pos.sell', 'stock.view']);
		await setRolePermissions(adminActor, clerkRole, await permissionIds('pos.sell'));
		expect((await loadGrant(clerk)).permList).toEqual(['pos.sell']);

		await updateRole(adminActor, clerkRole, { name: 'Clerk', description: '', isActive: false });
		expect((await loadGrant(clerk)).permList).toEqual([]);
	});

	it('keeps the Admin role whole', async () => {
		const { adminRoleId, adminActor } = await setup();
		await expect(setRolePermissions(adminActor, adminRoleId, [])).rejects.toThrow(/Admin role/);
		await expect(
			updateRole(adminActor, adminRoleId, { name: 'Boss', description: '', isActive: true })
		).rejects.toThrow(/Admin role/);
		await expect(deleteRole(adminActor, adminRoleId)).rejects.toThrow(/Admin role/);
		await expect(createRole(adminActor, { name: 'admin', description: '' }, [])).rejects.toThrow(
			/already a role/
		);
		const admin = (await listRoles()).find((r) => r.isAdmin);
		expect(admin?.permissions).toBe(permissionNames().length);
	});

	it('keeps a manager from changing permissions they do not hold', async () => {
		const { manager, clerkRole, adminActor } = await setup();
		const managerActor = await actorOf(manager);
		await expect(
			setRolePermissions(managerActor, clerkRole, await permissionIds('settings.manage'))
		).rejects.toThrow(/settings.manage/);
		// Nor take one away from a role.
		await setRolePermissions(adminActor, clerkRole, await permissionIds('pos.sell'));
		await expect(setRolePermissions(managerActor, clerkRole, [])).rejects.toThrow(/pos.sell/);
	});

	it('deletes a role only once nobody has it', async () => {
		const { adminActor, clerkRole, manager } = await setup();
		const clerk = await makeStaff({ roleId: clerkRole });
		await expect(deleteRole(await actorOf(manager), clerkRole)).rejects.toThrow(/Only an admin/);
		await expect(deleteRole(adminActor, clerkRole)).rejects.toThrow(/One person has/);
		await db.update(user).set({ roleId: null }).where(eq(user.id, clerk));
		await deleteRole(adminActor, clerkRole);
		expect((await listRoles()).map((r) => r.name)).not.toContain('Clerk');
		const [row] = await db.select().from(roles).where(eq(roles.id, clerkRole));
		expect(row.deletedAt).not.toBeNull();
	});
});
