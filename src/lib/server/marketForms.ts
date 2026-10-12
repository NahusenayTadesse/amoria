import { redirect, type RequestEvent } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { m } from '$lib/paraglide/messages.js';
import { getLocale, localizeHref } from '$lib/paraglide/runtime';
import { askSchema, bookSchema } from '$lib/schemas/renters';
import { askForQuote, bookNow } from '$lib/server/services/renterOrders';
import { takeToken } from '$lib/server/rateLimit';

/**
 * The marketplace's two storefront forms (§5.12), shared by a rental's page and a renter's page:
 * "Book now" on a fixed-price rental, and "Ask for a quote". Each validates, hands the order to
 * `renterOrders`, and sends the customer to the order's own page, `/rb/<token>`.
 */

/** The forms a page with them loads, under their own ids so both can sit on one page. */
export async function marketForms() {
	return {
		bookForm: await superValidate(zod4(bookSchema), { id: 'book' }),
		askForm: await superValidate(zod4(askSchema), { id: 'ask' })
	};
}

type Target = { listingSlug: string } | { renterSlug: string };

export async function marketOrder(event: RequestEvent, kind: 'book' | 'ask', target: Target) {
	const schema = kind === 'book' ? bookSchema : askSchema;
	const form = await superValidate(event.request, zod4(schema), { id: kind });

	if (!takeToken(`market:${event.getClientAddress()}`, { capacity: 8, perMinute: 6 })) {
		return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
	}
	if (!form.valid) {
		return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
	}

	const contact = {
		name: form.data.name,
		phone: normalizePhone(form.data.phone)!,
		email: form.data.email || null,
		locale: getLocale()
	};
	let placed;
	try {
		placed =
			kind === 'book' && 'listingSlug' in target
				? await bookNow(target.listingSlug, form.data, contact)
				: await askForQuote(target, form.data, contact);
	} catch (err) {
		if (err instanceof WriteRefused) {
			if (err.field) setError(form, err.field as 'startDate', err.message);
			return message(form, { type: 'error', text: err.message }, { status: 409 });
		}
		console.error('Marketplace: could not place the order:', err);
		return message(form, { type: 'error', text: m.checkout_error_failed() }, { status: 500 });
	}
	redirect(303, localizeHref(`/rb/${placed.token}`));
}
