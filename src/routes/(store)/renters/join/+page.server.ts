import { redirect } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime';
import { auth } from '$lib/server/auth';
import { isRenterUser, isStaff } from '$lib/server/staff';
import { registerRenter } from '$lib/server/services/renters';
import { takeToken } from '$lib/server/rateLimit';
import { renterJoinSchema } from '$lib/schemas/renters';

/**
 * "Rent out on Amoria" (`/renters/join`, §5.12): a business makes its renter account and sends the
 * papers staff check. The account works at once, so they can set up their shop and listings while
 * staff review them; nothing goes live until they are approved.
 */
export const load = async ({ locals }) => {
	if (isRenterUser(locals.user)) redirect(302, '/renter');
	return {
		signedInStaff: isStaff(locals.user),
		form: await superValidate(zod4(renterJoinSchema))
	};
};

export const actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await superValidate(request, zod4(renterJoinSchema));
		// The licence cannot travel back in the answer; the picker is emptied either way.
		const licence = form.data.tradeLicence;
		form.data.tradeLicence = undefined as unknown as File;

		if (!takeToken(`join:${getClientAddress()}`, { capacity: 4, perMinute: 2 })) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}

		let tradeLicenceFile: string;
		try {
			// Kept in the private store: staff read it; `/media` never serves it.
			tradeLicenceFile = await saveUploadedFile(licence);
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'tradeLicence', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}

		try {
			await registerRenter({
				ownerName: form.data.ownerName,
				email: form.data.email,
				password: form.data.password,
				businessName: form.data.businessName,
				phone: form.data.phone,
				area: form.data.area,
				tinNumber: form.data.tinNumber,
				tradeLicenceFile,
				locale: getLocale()
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as 'email', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			console.error('Renter sign-up failed:', err);
			return message(form, { type: 'error', text: m.checkout_error_failed() }, { status: 500 });
		}

		// Signed in as the new renter (better-auth sets the cookie through the SvelteKit plugin).
		await auth.api.signInEmail({
			body: { email: form.data.email.trim().toLowerCase(), password: form.data.password },
			headers: request.headers
		});
		redirect(303, '/renter?welcome=1');
	}
};
