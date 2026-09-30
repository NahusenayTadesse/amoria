import { createAccess } from '@nahu/admin-kit/access';

/**
 * Who may open what: one rule per route prefix, first match wins, so specific prefixes go before
 * general ones. Pages under /dashboard with no rule are closed — add a rule with every new page.
 * `permission: null` means any staff member (the dashboard layout already refuses customers).
 *
 * The permission names here are also what `$lib/server/permissions` seeds into the `permissions`
 * table, together with the code-only ones listed there (§4.4).
 */
export const access = createAccess({
	root: '/dashboard',
	rules: [
		{ prefix: '/dashboard', permission: null, exact: true },
		{ prefix: '/dashboard/files/', permission: null },
		{ prefix: '/dashboard/orders', permission: 'orders.view' },
		{ prefix: '/dashboard/products', permission: 'catalog.manage' },
		{ prefix: '/dashboard/categories', permission: 'catalog.manage' },
		{ prefix: '/dashboard/stock', permission: 'stock.view' },
		{ prefix: '/dashboard/school', permission: 'school.manage' },
		{ prefix: '/dashboard/settings', permission: 'settings.manage' }
	]
});
