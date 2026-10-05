import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { getLocale } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';
import { quoteRequestSchema } from '$lib/schemas/quote';
import { createQuoteRequest, quoteFormOptions } from '$lib/server/services/quotes';
import { takeToken } from '$lib/server/rateLimit';

export type QuoteMessage = { type: 'success' | 'error'; text: string };

/**
 * "Plan your décor" (§5.5, §10): a customer asks for a quote. No account; the contact details are
 * the only required part. `?package=<slug>` arrives with that package chosen, and `?type=<slug>`
 * with an event type.
 */
export const load = async ({ url }) => {
	const options = await quoteFormOptions();
	const form = await superValidate<typeof quoteRequestSchema._zod.output, QuoteMessage>(
		zod4(quoteRequestSchema),
		{ errors: false }
	);

	const pack = options.packages.find((p) => p.slug === url.searchParams.get('package'));
	if (pack) {
		form.data.packageId = pack.id;
		form.data.eventTypeId = pack.eventTypeId;
	}
	return { form, ...options };
};

export const actions = {
	request: async ({ request, getClientAddress }) => {
		const form = await superValidate<typeof quoteRequestSchema._zod.output, QuoteMessage>(
			request,
			zod4(quoteRequestSchema)
		);

		if (!takeToken(`quote:${getClientAddress()}`, { capacity: 6, perMinute: 6 })) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}

		try {
			await createQuoteRequest(form.data, {
				name: form.data.name,
				phone: normalizePhone(form.data.phone)!,
				email: form.data.email || null,
				locale: getLocale()
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as 'eventDate', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			console.error('Quote request: could not save:', err);
			return message(form, { type: 'error', text: m.quote_failed() }, { status: 500 });
		}

		return message(form, { type: 'success', text: m.quote_sent_heading() });
	}
};
