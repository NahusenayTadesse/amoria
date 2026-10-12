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

/**
 * Who counts as a renter (§5.12): a business account made at `/renters/join`, still active. Gates
 * `/renter`. Whether the business is *approved* is the renter row's status, checked per action.
 */
export function isRenterUser(
	user: { role?: string | null; isActive?: boolean | null } | null | undefined
): boolean {
	return Boolean(user && user.role === 'renter' && user.isActive !== false);
}
