import { error } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { saveUploadedFile } from '@nahu/admin-kit/server/files';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { getLocale } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';
import { cartLines, checkoutSchema } from '$lib/schemas/checkout';
import { giftCategories, giftProducts } from '$lib/server/services/catalog';
import { getSettings } from '$lib/server/services/settings';
import { deliveryOptions } from '$lib/server/services/delivery';
import { createFromCart } from '$lib/server/services/orders';
import {
	PaymentStartError,
	startChapa,
	submitTransfer,
	transferAccounts
} from '$lib/server/services/payments';
import { takeToken } from '$lib/server/rateLimit';

/** The form's message: the kit's toast shape, plus where the browser goes next. */
export type CheckoutMessage = {
	type: 'success' | 'error';
	text: string;
	/** Chapa's hosted page — a full navigation, not `goto`. */
	checkoutUrl?: string;
	/** The order's own page, `/o/<token>`. */
	statusPath?: string;
};

export const load = async ({ params }) => {
	const [categories, products, settings, accounts, delivery] = await Promise.all([
		giftCategories(),
		giftProducts(),
		getSettings(),
		transferAccounts(),
		deliveryOptions()
	]);

	const active = params.category ? categories.find((c) => c.slug === params.category) : undefined;
	if (params.category && !active) error(404, 'No such category');

	return {
		categories,
		products,
		activeCategoryId: active?.id ?? null,
		holdMinutes: settings.holdMinutes,
		accounts,
		delivery,
		form: await superValidate<typeof checkoutSchema._zod.output, CheckoutMessage>(
			zod4(checkoutSchema)
		)
	};
};

export const actions = {
	/**
	 * Places the order and starts paying for it (§11 "Gift direct-buy"): Chapa, or a transfer
	 * with its receipt. Thin on purpose — validation here, the rules in `orders` and `payments`.
	 */
	checkout: async ({ request, url, getClientAddress }) => {
		const form = await superValidate<typeof checkoutSchema._zod.output, CheckoutMessage>(
			request,
			zod4(checkoutSchema)
		);

		if (!takeToken(`checkout:${getClientAddress()}`, { capacity: 8, perMinute: 6 })) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}

		let lines;
		try {
			lines = cartLines.parse(JSON.parse(form.data.cart));
		} catch {
			return message(form, { type: 'error', text: m.checkout_error_bag() }, { status: 400 });
		}

		const { name, email, notes, method, bankAccountId, receipt, fulfilment } = form.data;
		// Validated by the schema already; normalised here into the one stored shape.
		const phone = normalizePhone(form.data.phone)!;

		let order;
		try {
			order = await createFromCart({
				lines,
				contact: { name, phone, email: email || null, locale: getLocale() },
				fulfilment:
					fulfilment === 'delivery'
						? {
								type: 'delivery',
								areaId: form.data.deliveryAreaId!,
								address: form.data.deliveryAddress
							}
						: { type: 'pickup' },
				notes: notes || null,
				sourceId: null
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				// A refusal about a field goes under that field, and the toast says it too.
				if (err.field) setError(form, err.field as 'deliveryAreaId', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			console.error('Checkout: could not place the order:', err);
			return message(form, { type: 'error', text: m.checkout_error_failed() }, { status: 500 });
		}

		const statusPath = `/o/${order.token}`;

		if (method === 'transfer') {
			// The order exists either way. If the receipt does not go through, the customer lands on
			// the order page, which offers the transfer form (and Chapa) again.
			try {
				const receiptFile = await saveUploadedFile(receipt);
				await submitTransfer('order', order.id, { bankAccountId: bankAccountId!, receiptFile });
			} catch (err) {
				if (!(err instanceof WriteRefused))
					console.error(`Checkout: receipt for order ${order.id}:`, err);
				return message(form, {
					type: 'error',
					text: err instanceof WriteRefused ? err.message : m.checkout_error_receipt_upload(),
					statusPath
				});
			}
			return message(form, { type: 'success', text: m.checkout_placed_transfer(), statusPath });
		}

		try {
			const checkoutUrl = await startChapa('order', order.id, url.origin);
			return message(form, {
				type: 'success',
				text: m.checkout_redirecting(),
				checkoutUrl,
				statusPath
			});
		} catch (err) {
			console.error(`Checkout: Chapa for order ${order.id}:`, err);
			// The order stands; its page offers a retry and the transfer instead.
			return message(form, {
				type: 'error',
				text: m.order_payment_unavailable(),
				statusPath:
					err instanceof PaymentStartError ? `${statusPath}?payment=unavailable` : statusPath
			});
		}
	}
};
