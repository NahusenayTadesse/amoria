import { listStaff } from '$lib/server/services/staff';

export const load = async () => ({ rows: await listStaff() });
