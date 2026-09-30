import { index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { roles, user } from './auth';
import { secureFields } from './secureFields';

/** Permission names, synced from `$lib/permissions.ts` once per boot (idempotent and additive). */
export const permissions = mysqlTable('permissions', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 50 }).notNull().unique(),
	description: varchar('description', { length: 255 })
});

/**
 * dentalClinic's model, but `restrict` rather than `cascade` (§3.1): removing a role or a
 * permission clears its links in app code first.
 */
export const rolePermissions = mysqlTable(
	'role_permissions',
	{
		id: int('id').autoincrement().primaryKey(),
		roleId: int('role_id')
			.notNull()
			.references(() => roles.id, { onDelete: 'restrict' }),
		permissionId: int('permission_id')
			.notNull()
			.references(() => permissions.id, { onDelete: 'restrict' }),
		...secureFields
	},
	(table) => [index('role_permissions_role_idx').on(table.roleId, table.permissionId)]
);

/** Permissions granted to one user on top of their role's. */
export const specialPermissions = mysqlTable(
	'special_permissions',
	{
		id: int('id').autoincrement().primaryKey(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		permissionId: int('permission_id')
			.notNull()
			.references(() => permissions.id, { onDelete: 'restrict' }),
		...secureFields
	},
	(table) => [uniqueIndex('special_permissions_user_perm_idx').on(table.userId, table.permissionId)]
);

export const rolesRelations = relations(roles, ({ many }) => ({
	rolePermissions: many(rolePermissions)
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
	rolePermissions: many(rolePermissions),
	specialPermissions: many(specialPermissions)
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
	role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	})
}));

export const specialPermissionsRelations = relations(specialPermissions, ({ one }) => ({
	user: one(user, { fields: [specialPermissions.userId], references: [user.id] }),
	permission: one(permissions, {
		fields: [specialPermissions.permissionId],
		references: [permissions.id]
	})
}));
