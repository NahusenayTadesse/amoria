import { listRoles, listStaff } from '$lib/server/services/staff';

export const load = async () => {
	const [staff, roles] = await Promise.all([listStaff(), listRoles()]);
	return {
		activeStaff: staff.filter((s) => s.isActive).length,
		inactiveStaff: staff.filter((s) => !s.isActive).length,
		roles: roles.length
	};
};
