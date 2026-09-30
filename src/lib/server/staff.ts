/**
 * Who counts as staff: an account made from the dashboard (`staff`) or seeded (`admin`), still
 * active. `user.role` is never settable from sign-up input (`input: false`), so it can be trusted.
 */
export function isStaff(
	user: { role?: string | null; isActive?: boolean | null } | null | undefined
): boolean {
	return Boolean(
		user && (user.role === 'staff' || user.role === 'admin') && user.isActive !== false
	);
}
