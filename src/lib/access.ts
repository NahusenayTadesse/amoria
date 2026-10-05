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
		// Specific stock prefixes first: the first match wins.
		{ prefix: '/dashboard/stock/documents', permission: 'stock.adjust' },
		{ prefix: '/dashboard/stock/counts', permission: 'stock.count' },
		{ prefix: '/dashboard/stock/locations', permission: 'settings.manage' },
		{ prefix: '/dashboard/stock', permission: 'stock.view' },
		{ prefix: '/dashboard/suppliers', permission: 'purchasing.manage' },
		{ prefix: '/dashboard/purchasing', permission: 'purchasing.manage' },
		{ prefix: '/dashboard/requisitions', permission: 'requisitions.request' },
		{ prefix: '/dashboard/pos', permission: 'pos.sell' },
		{ prefix: '/dashboard/reports', permission: 'reports.view' },
		{ prefix: '/dashboard/import', permission: 'data.import' },
		{ prefix: '/dashboard/labels', permission: 'catalog.manage' },
		{ prefix: '/dashboard/school', permission: 'school.manage' },
		{ prefix: '/dashboard/quote-requests', permission: 'quotes.manage' },
		{ prefix: '/dashboard/settings', permission: 'settings.manage' }
	]
});
