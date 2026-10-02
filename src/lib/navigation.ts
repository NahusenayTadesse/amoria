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
import Receipt from '@lucide/svelte/icons/receipt';
import Calculator from '@lucide/svelte/icons/calculator';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
import Warehouse from '@lucide/svelte/icons/warehouse';
import Factory from '@lucide/svelte/icons/factory';
import Timer from '@lucide/svelte/icons/timer';
import ChartColumn from '@lucide/svelte/icons/chart-column';
import Upload from '@lucide/svelte/icons/upload';
import Barcode from '@lucide/svelte/icons/barcode';
import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
import PackageOpen from '@lucide/svelte/icons/package-open';
import Lightbulb from '@lucide/svelte/icons/lightbulb';
import Clock from '@lucide/svelte/icons/clock';
import type { NavItem } from '@nahu/admin-kit/navigation';

/** The sidebar and the search palette. Each entry is shown only if `access` lets the viewer in. */
export const NAVIGATION: NavItem[] = [
	{ title: 'Today', url: '/dashboard', icon: LayoutDashboard },
	{ title: 'Orders', url: '/dashboard/orders', icon: ShoppingBag },
	{ title: 'Products', url: '/dashboard/products', icon: Package },
	{ title: 'Categories', url: '/dashboard/categories', icon: Tags },
	{
		title: 'Till',
		url: '/dashboard/pos',
		icon: Calculator,
		items: [
			{ title: 'Sell', url: '/dashboard/pos', icon: Calculator },
			{ title: 'Shifts', url: '/dashboard/pos/shifts', icon: Clock }
		]
	},
	{
		title: 'School',
		url: '/dashboard/school',
		icon: GraduationCap,
		items: [
			{ title: 'Courses', url: '/dashboard/school', icon: BookOpen },
			{ title: 'Students', url: '/dashboard/school/students', icon: Users },
			{ title: 'Shifts', url: '/dashboard/school/shifts', icon: Clock }
		]
	},
	{
		title: 'Stock',
		url: '/dashboard/stock',
		icon: Boxes,
		items: [
			{ title: 'Levels', url: '/dashboard/stock', icon: ListOrdered },
			{ title: 'Ledger', url: '/dashboard/stock/ledger', icon: ScrollText },
			{ title: 'Documents', url: '/dashboard/stock/documents', icon: Receipt },
			{ title: 'Counts', url: '/dashboard/stock/counts', icon: ClipboardCheck },
			{ title: 'Expiry', url: '/dashboard/stock/expiry', icon: Timer },
			{ title: 'Locations', url: '/dashboard/stock/locations', icon: Warehouse }
		]
	},
	{
		title: 'Purchasing',
		url: '/dashboard/purchasing',
		icon: ShoppingCart,
		items: [
			{ title: 'Orders', url: '/dashboard/purchasing', icon: ShoppingCart },
			{ title: 'Reorder', url: '/dashboard/purchasing/reorder', icon: Lightbulb },
			{ title: 'Suppliers', url: '/dashboard/suppliers', icon: Factory }
		]
	},
	{ title: 'Requisitions', url: '/dashboard/requisitions', icon: ClipboardList },
	{
		title: 'Reports',
		url: '/dashboard/reports',
		icon: ChartColumn
	},
	{
		title: 'Data',
		url: '/dashboard/import',
		icon: PackageOpen,
		items: [
			{ title: 'Import', url: '/dashboard/import', icon: Upload },
			{ title: 'Labels', url: '/dashboard/labels', icon: Barcode }
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
	document: '/dashboard/stock/documents',
	supplier: '/dashboard/suppliers',
	purchase_order: '/dashboard/purchasing',
	count: '/dashboard/stock/counts',
	requisition: '/dashboard/requisitions',
	pos_shift: '/dashboard/pos/shifts',
	course: '/dashboard/school',
	registration: '/dashboard/school/students'
};
