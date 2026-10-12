import { error } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { m } from '$lib/paraglide/messages.js';
import { transferSchema } from '$lib/schemas/checkout';
import {
	acceptQuote,
	cancelByCustomer,
	renterOrderByToken,
	submitReceipt
} from '$lib/server/services/renterOrders';
import { renterAccounts } from '$lib/server/services/renters';
import { takeToken } from '$lib/server/rateLimit';

/**
 * A marketplace order's own page (`/rb/[token]`, §5.12), for whoever holds the link: where it
 * stands, the renter's price to accept, the renter's accounts to pay into and the receipt to send,
 * and a way to call it off while nothing is paid. Shows the contact only as the number they call.
 */
export const load = async ({ params }) => {
	const found = await renterOrderByToken(params.token);
	if (!found) error(404, 'Booking not found');
	const { order, renter, listingSlug, payments } = found;
	const paying = order.status === 'pending_payment';
	return {
		order: {
			ref: order.ref ?? String(order.id),
			status: order.status,
			origin: order.origin,
			title: order.titleSnapshot,
			startDate: order.startDate,
			endDate: order.endDate,
			qty: order.qty,
			hours: order.hours,
			venue: order.venue,
			message: order.message,
			unitPrice: order.unitPrice,
			priceUnit: order.priceUnit,
			subtotal: order.subtotal,
			deposit: order.deposit,
			total: order.total,
			renterNote: order.renterNote,
			validUntil: order.validUntil,
			holdExpiresAt: order.holdExpiresAt,
			phone: order.contactPhone,
			createdAt: order.createdAt
		},
		renter,
		listingSlug,
		payments,
		accounts: paying ? await renterAccounts(renter.id) : [],
		transferForm: await superValidate(zod4(transferSchema))
	};
};

function limited(address: string) {
	return !takeToken(`rb:${address}`, { capacity: 10, perMinute: 6 });
}

export const actions = {
	accept: async ({ params, getClientAddress }) => {
		if (limited(getClientAddress())) return { refused: m.checkout_error_rate() };
		try {
			await acceptQuote(params.token);
		} catch (err) {
			if (err instanceof WriteRefused) return { refused: err.message };
			throw err;
		}
		return { done: m.rb_accepted() };
	},

	cancel: async ({ params, getClientAddress }) => {
		if (limited(getClientAddress())) return { refused: m.checkout_error_rate() };
		try {
			await cancelByCustomer(params.token);
		} catch (err) {
			if (err instanceof WriteRefused) return { refused: err.message };
			throw err;
		}
		return { done: m.rb_cancelled() };
	},

	transfer: async ({ params, request, getClientAddress }) => {
		const form = await superValidate(request, zod4(transferSchema));
		const receipt = form.data.receipt;
		form.data.receipt = undefined as unknown as File;
		if (limited(getClientAddress())) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}
		try {
			const receiptFile = await saveUploadedFile(receipt);
			await submitReceipt(params.token, {
				bankAccountId: form.data.bankAccountId,
				receiptFile
			});
		} catch (err) {
			if (err instanceof UploadRefused || err instanceof WriteRefused) {
				if (err instanceof WriteRefused && err.field) {
					setError(form, err.field as 'bankAccountId', err.message);
				}
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: m.rb_receipt_sent() });
	}
};
