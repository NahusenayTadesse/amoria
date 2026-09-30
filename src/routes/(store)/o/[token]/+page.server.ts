import { error } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages.js';
import { orderByToken } from '$lib/server/services/orders';
import { verify } from '$lib/server/services/payments';
import { payActions, payPanelData } from '$lib/server/paymentActions';

/**
 * An order's own page (§10 `/o/[token]`). Reachable by anyone holding the link — it gets
 * forwarded and screenshotted — so it shows what the customer needs and nothing more: no email,
 * and the phone only as the number we will call.
 */
export const load = async ({ params, url }) => {
	let found = await orderByToken(params.token);
	if (!found) error(404, 'Order not found');

	// Coming back from Chapa, or checking again: ask about the newest online attempt still open.
	// `verify` is idempotent, so a reload costs one call to Chapa at most.
	const open = found.payments.find((p) => p.provider === 'chapa' && p.status === 'initiated');
	if (open && found.order.status === 'pending_payment') {
		const outcome = await verify(open.txRef);
		if (outcome.status !== 'pending') found = (await orderByToken(params.token))!;
	}

	const { order, items, payments } = found;
	const inReview =
		order.status === 'pending_payment' &&
		payments.some((p) => p.provider === 'bank_transfer' && p.status === 'initiated');

	return {
		order: {
			ref: order.ref ?? String(order.id),
			status: order.status,
			inReview,
			subtotal: order.subtotal,
			deliveryFee: order.deliveryFee,
			total: order.total,
			fulfilment: order.fulfilment,
			deliveryAreaName: order.deliveryAreaName,
			deliveryAddress: order.deliveryAddress,
			phone: order.contactPhone,
			createdAt: order.createdAt,
			holdExpiresAt: order.holdExpiresAt
		},
		items,
		/** `?payment=` from the return trip: paid, failed, pending or unavailable. */
		paymentNotice: url.searchParams.get('payment'),
		...(await payPanelData(order.status === 'pending_payment' && !inReview))
	};
};

export const actions = payActions({
	kind: 'order',
	find: async (token) => {
		const found = await orderByToken(token);
		return found ? { id: found.order.id } : null;
	},
	statusPath: (token) => `/o/${token}`,
	receiptReceived: () => m.order_receipt_received(),
	notFound: 'Order not found'
});
