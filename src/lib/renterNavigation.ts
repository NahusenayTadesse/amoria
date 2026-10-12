import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import MessageSquareQuote from '@lucide/svelte/icons/message-square-quote';
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import Package from '@lucide/svelte/icons/package';
import Landmark from '@lucide/svelte/icons/landmark';
import Store from '@lucide/svelte/icons/store';
import { createAccess } from '@nahu/admin-kit/access';
import type { NavItem } from '@nahu/admin-kit/navigation';

/**
 * The renters' dashboard (§5.12) is its own area, `/renter`, outside the staff permissions: every
 * page is for the signed-in renter, and `hooks.server.ts` already refused anyone else. One rule
 * opens the area for the kit's shell, which reads it to draw the menu.
 */
export const renterAccess = createAccess({
	root: '/renter',
	rules: [{ prefix: '/renter', permission: null }]
});

export const RENTER_NAVIGATION: NavItem[] = [
	{ title: 'Overview', url: '/renter', icon: LayoutDashboard },
	{ title: 'Quote requests', url: '/renter/requests', icon: MessageSquareQuote },
	{ title: 'Orders and payments', url: '/renter/orders', icon: ReceiptText },
	{ title: 'My rentals', url: '/renter/listings', icon: Package },
	{ title: 'Bank accounts', url: '/renter/bank-accounts', icon: Landmark },
	{ title: 'Shop profile', url: '/renter/profile', icon: Store }
];

/** Where each kind of record's page lives in this area, for table links. */
export const RENTER_ENTITIES: Record<string, string> = {
	renter_order: '/renter/orders',
	renter_listing: '/renter/listings'
};
