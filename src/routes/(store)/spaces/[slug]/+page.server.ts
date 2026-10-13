import { error } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { getLocale } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';
import { spaceBookingSchema } from '$lib/schemas/quote';
import { rentalSpaceBySlug } from '$lib/server/services/spaces';
import { createQuoteRequest, quoteFormOptions } from '$lib/server/services/quotes';
import { getSettings, publicContact } from '$lib/server/services/settings';
import { takeToken } from '$lib/server/rateLimit';

export type BookingMessage = { type: 'success' | 'error'; text: string };

/** One space (`/spaces/[slug]`): its write-up, features, video, gallery and booking form. */
export const load = async ({ params }) => {
	const [space, settings, options] = await Promise.all([
		rentalSpaceBySlug(params.slug),
		getSettings(),
		quoteFormOptions()
	]);
	if (!space) error(404, 'Space not found');
	const form = await superValidate<typeof spaceBookingSchema._zod.output, BookingMessage>(
		zod4(spaceBookingSchema),
		{ errors: false }
	);
	return { space, contact: publicContact(settings), events: options.events, form };
};

export const actions = {
	/** "Book this space": saved as a request of kind `space`, answered from the staff inbox. */
	book: async ({ request, params, getClientAddress }) => {
		const form = await superValidate<typeof spaceBookingSchema._zod.output, BookingMessage>(
			request,
			zod4(spaceBookingSchema)
		);

		if (!takeToken(`quote:${getClientAddress()}`, { capacity: 6, perMinute: 6 })) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}
		const space = await rentalSpaceBySlug(params.slug);
		if (!space) error(404, 'Space not found');

		try {
			await createQuoteRequest(
				{ ...form.data, venue: space.name },
				{
					name: form.data.name,
					phone: normalizePhone(form.data.phone)!,
					email: form.data.email || null,
					locale: getLocale()
				},
				{ kind: 'space', spaceId: space.id }
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as 'eventDate', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			console.error('Space booking: could not save:', err);
			return message(form, { type: 'error', text: m.quote_failed() }, { status: 500 });
		}

		return message(form, { type: 'success', text: m.spaces_booked_heading() });
	}
};
