import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Package from '@lucide/svelte/icons/package';
import Tags from '@lucide/svelte/icons/tags';
import Boxes from '@lucide/svelte/icons/boxes';
import Settings from '@lucide/svelte/icons/settings';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Store from '@lucide/svelte/icons/store';
import Truck from '@lucide/svelte/icons/truck';
import Landmark from '@lucide/svelte/icons/landmark';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import BookOpen from '@lucide/svelte/icons/book-open';
import Users from '@lucide/svelte/icons/users';
import type { NavItem } from '@nahu/admin-kit/navigation';

/** The sidebar and the search palette. Each entry is shown only if `access` lets the viewer in. */
export const NAVIGATION: NavItem[] = [
	{ title: 'Today', url: '/dashboard', icon: LayoutDashboard },
	{ title: 'Orders', url: '/dashboard/orders', icon: ShoppingBag },
	{ title: 'Products', url: '/dashboard/products', icon: Package },
	{ title: 'Categories', url: '/dashboard/categories', icon: Tags },
	{
		title: 'School',
		url: '/dashboard/school',
		icon: GraduationCap,
		items: [
			{ title: 'Courses', url: '/dashboard/school', icon: BookOpen },
			{ title: 'Students', url: '/dashboard/school/students', icon: Users }
		]
	},
	{
		title: 'Stock',
		url: '/dashboard/stock',
		icon: Boxes,
		items: [
			{ title: 'Levels', url: '/dashboard/stock', icon: ListOrdered },
			{ title: 'Ledger', url: '/dashboard/stock/ledger', icon: ScrollText }
		]
	},
	{
		title: 'Settings',
		url: '/dashboard/settings',
		icon: Settings,
		items: [
			{ title: 'Shop settings', url: '/dashboard/settings', icon: Store },
			{ title: 'Delivery areas', url: '/dashboard/settings/delivery-areas', icon: Truck },
			{ title: 'Bank accounts', url: '/dashboard/settings/bank-accounts', icon: Landmark }
		]
	}
];

/** Where each kind of record's page lives, so table cells can link to it. */
export const ENTITIES: Record<string, string> = {
	order: '/dashboard/orders',
	product: '/dashboard/products',
	course: '/dashboard/school',
	registration: '/dashboard/school/students'
};
