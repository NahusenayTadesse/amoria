import { error, fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { customer, orderItem, orders, stockMovement } from '$lib/server/db/schema';
import { setOrderStatus } from '$lib/server/services/orders';
import {
	actorOf,
	paymentAdminActions,
	paymentsCardData,
	paymentsFor
} from '$lib/server/paymentAdmin';
import { orderStatusSchema } from '$lib/schemas/dashboard';

function orderId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Order not found');
	return id;
}

export const load = async ({ params, locals }) => {
	const id = orderId(params);
	const [order] = await db.select().from(orders).where(eq(orders.id, id));
	if (!order) error(404, 'Order not found');

	const [items, payments, movements, [buyer]] = await Promise.all([
		db.select().from(orderItem).where(eq(orderItem.orderId, id)).orderBy(asc(orderItem.id)),
		paymentsFor('order', id),
		db
			.select({
				id: stockMovement.id,
				delta: stockMovement.delta,
				reason: stockMovement.reason,
				productId: stockMovement.productId,
				createdAt: stockMovement.createdAt
			})
			.from(stockMovement)
			.where(and(eq(stockMovement.refType, 'order'), eq(stockMovement.refId, id)))
			.orderBy(asc(stockMovement.id)),
		db
			.select({ id: customer.id, email: customer.email })
			.from(customer)
			.where(eq(customer.id, order.customerId))
	]);

	return {
		order,
		items,
		payments,
		movements,
		customerEmail: buyer?.email ?? null,
		can: { manage: hasPermission(locals, 'orders.manage') },
		...(await paymentsCardData({ locals }))
	};
};

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(orderStatusSchema));
		if (!form.valid) return fail(400, { error: 'Choose what the order becomes.' });
		try {
			await setOrderStatus(
				orderId(event.params),
				form.data.to,
				actorOf(event),
				form.data.note || undefined
			);
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
		return { done: 'Order updated' };
	},

	...paymentAdminActions({ kind: 'order', idOf: orderId, noun: 'order' })
};
