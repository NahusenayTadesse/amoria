import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addLocalDays, localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { renterListing, renterOrder } from '$lib/server/db/schema';
import { currentRenter, renterActor } from '$lib/server/renterArea';
import {
	acceptReceipt,
	moveOrder,
	receiptsFor,
	rejectReceipt,
	sendQuote
} from '$lib/server/services/renterOrders';
import { attempt, formAttempt } from '$lib/server/attempt';
import { reasonSchema, renterReceiptRejectSchema, sendQuoteSchema } from '$lib/schemas/renters';

/**
 * One order, for the renter who owns it: send or change a quote, check the payment receipts the
 * customer sent, hand it over and finish it, or call it off with a reason.
 */
async function own(locals: App.Locals, params: { id?: string }) {
	const renter = await currentRenter(locals);
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Order not found');
	const [row] = await db
		.select({
			order: renterOrder,
			listingSlug: renterListing.slug,
			listingPrice: renterListing.price
		})
		.from(renterOrder)
		.leftJoin(renterListing, eq(renterListing.id, renterOrder.listingId))
		.where(and(eq(renterOrder.id, id), eq(renterOrder.renterId, renter.id)));
	if (!row) error(404, 'Order not found');
	return { renter, ...row };
}

export const load = async ({ locals, params }) => {
	const { order, listingSlug, listingPrice } = await own(locals, params);
	const receipts = await receiptsFor(order.id);
	// The customer's link and record stay with Amoria: the renter sees neither.
	const shown = Object.fromEntries(
		Object.entries(order).filter(([key]) => key !== 'publicToken' && key !== 'customerId')
	) as Omit<typeof order, 'publicToken' | 'customerId'>;
	return {
		order: shown,
		listingSlug,
		receipts,
		quoteForm: await superValidate(
			{
				subtotal: order.subtotal ?? listingPrice ?? undefined,
				deposit: order.deposit,
				validUntil: order.validUntil ?? addLocalDays(localToday(), 7),
				note: order.renterNote ?? ''
			},
			zod4(sendQuoteSchema),
			{ errors: false }
		),
		reasonForm: await superValidate(zod4(reasonSchema)),
		rejectForm: await superValidate(zod4(renterReceiptRejectSchema))
	};
};

export const actions = {
	quote: async (event) => {
		const { renter, order } = await own(event.locals, event.params);
		const form = await superValidate(event.request, zod4(sendQuoteSchema));
		return formAttempt(
			form,
			() => sendQuote(renterActor(event), renter.id, order.id, form.data),
			'Quote sent. The customer sees it on their booking page.'
		);
	},

	decline: async (event) => {
		const { renter, order } = await own(event.locals, event.params);
		const form = await superValidate(event.request, zod4(reasonSchema));
		return formAttempt(
			form,
			() => moveOrder(renterActor(event), renter.id, order.id, 'declined', form.data.reason),
			'Declined.'
		);
	},

	cancel: async (event) => {
		const { renter, order } = await own(event.locals, event.params);
		const form = await superValidate(event.request, zod4(reasonSchema));
		return formAttempt(
			form,
			() => moveOrder(renterActor(event), renter.id, order.id, 'cancelled', form.data.reason),
			'Cancelled.'
		);
	},

	out: async (event) => {
		const { renter, order } = await own(event.locals, event.params);
		return attempt(
			() => moveOrder(renterActor(event), renter.id, order.id, 'out', null),
			'Marked as with the customer.'
		);
	},

	complete: async (event) => {
		const { renter, order } = await own(event.locals, event.params);
		return attempt(
			() => moveOrder(renterActor(event), renter.id, order.id, 'completed', null),
			'Completed. Thank you!'
		);
	},

	acceptReceipt: async (event) => {
		const { renter } = await own(event.locals, event.params);
		const paymentId = Number((await event.request.formData()).get('paymentId'));
		return attempt(
			() => acceptReceipt(renterActor(event), renter.id, paymentId),
			'Payment confirmed: the booking is yours.'
		);
	},

	rejectReceipt: async (event) => {
		const { renter } = await own(event.locals, event.params);
		const form = await superValidate(event.request, zod4(renterReceiptRejectSchema));
		return formAttempt(
			form,
			() => rejectReceipt(renterActor(event), renter.id, form.data.paymentId, form.data.reason),
			'Receipt turned down. The customer can pay again.'
		);
	}
};
