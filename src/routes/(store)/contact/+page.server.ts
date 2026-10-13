import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { getLocale } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';
import { contactMessageSchema } from '$lib/schemas/quote';
import { createQuoteRequest } from '$lib/server/services/quotes';
import { getSettings, publicContact } from '$lib/server/services/settings';
import { takeToken } from '$lib/server/rateLimit';

export type ContactFormMessage = { type: 'success' | 'error'; text: string };

/**
 * Not prerendered, though §10 lists `/contact` among the static pages: the phone, chat handles and
 * address are Settings (§5.10) that staff edit, and a prerendered page would freeze whatever the
 * database held at build time. The read is cached, so this costs no query per visit. The page
 * also has a message form, which needs the server.
 */
export const load = async () => {
	const [settings, form] = await Promise.all([
		getSettings(),
		superValidate<typeof contactMessageSchema._zod.output, ContactFormMessage>(
			zod4(contactMessageSchema),
			{ errors: false }
		)
	]);
	return { contact: publicContact(settings), form };
};

export const actions = {
	/** A note from the page: saved as a request of kind `contact`, in the staff inbox. */
	send: async ({ request, getClientAddress }) => {
		const form = await superValidate<typeof contactMessageSchema._zod.output, ContactFormMessage>(
			request,
			zod4(contactMessageSchema)
		);

		if (!takeToken(`quote:${getClientAddress()}`, { capacity: 6, perMinute: 6 })) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}

		try {
			await createQuoteRequest(
				form.data,
				{
					name: form.data.name,
					phone: normalizePhone(form.data.phone)!,
					email: form.data.email || null,
					locale: getLocale()
				},
				{ kind: 'contact' }
			);
		} catch (err) {
			console.error('Contact message: could not save:', err);
			return message(form, { type: 'error', text: m.quote_failed() }, { status: 500 });
		}

		return message(form, { type: 'success', text: m.contact_form_sent_heading() });
	}
};
