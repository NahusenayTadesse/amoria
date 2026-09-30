import { createFileHandler } from '@nahu/admin-kit/server/serveFile';
import { isStaff } from '$lib/server/staff';

/**
 * Private uploads — transfer receipts above all — for staff only (§4.3 fix 3). A signed-in
 * customer gets a 404, the same as a name that does not exist.
 */
export const GET = createFileHandler<App.Locals>({ canRead: (locals) => isStaff(locals.user) });
