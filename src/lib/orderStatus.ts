import type { ORDER_STATUSES } from './constants';

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Where an order may go next, by hand, from the dashboard. The one table both the buttons on the
 * order page and `orders.setStatus` read, so a button is never offered that the server refuses.
 *
 * Getting paid is not here: that only happens through a verified payment (`Payable.onPaid`).
 * `expired` is set only by the `expire-holds` job.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	pending_payment: ['cancelled'],
	paid: ['preparing', 'ready', 'completed', 'cancelled'],
	preparing: ['ready', 'completed', 'cancelled'],
	ready: ['completed', 'cancelled'],
	// Staff rebooked it (the stock is taken again) or refunded it.
	paid_unfulfillable: ['preparing', 'cancelled'],
	completed: [],
	cancelled: [],
	expired: []
};

/** Statuses whose stock is still set aside for the order, and goes back on the shelf if cancelled. */
export const HOLDS_STOCK: OrderStatus[] = ['pending_payment', 'paid', 'preparing', 'ready'];

/** Money has been received for these; cancelling one means a refund. */
export const PAID: OrderStatus[] = [
	'paid',
	'preparing',
	'ready',
	'completed',
	'paid_unfulfillable'
];

/** Staff wording, for the dashboard (the storefront has its own, translated). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	pending_payment: 'Awaiting payment',
	paid: 'Paid',
	preparing: 'Preparing',
	ready: 'Ready',
	completed: 'Completed',
	cancelled: 'Cancelled',
	expired: 'Expired',
	paid_unfulfillable: 'Paid, item short'
};

/** The button that moves an order to each status. */
export const ORDER_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
	preparing: 'Start preparing',
	ready: 'Mark ready',
	completed: 'Mark collected / delivered',
	cancelled: 'Cancel order'
};
