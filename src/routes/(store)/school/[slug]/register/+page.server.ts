import { error } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { saveUploadedFile } from '@nahu/admin-kit/server/files';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { getLocale } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';
import { registrationSchema } from '$lib/schemas/school';
import { joinableIntake, register, schoolCourse } from '$lib/server/services/school';
import { courseDays, upcomingRanges } from '$lib/schoolPlan';
import { getSettings } from '$lib/server/services/settings';
import {
	PaymentStartError,
	startChapa,
	submitTransfer,
	transferAccounts
} from '$lib/server/services/payments';
import { takeToken } from '$lib/server/rateLimit';

/** The form's message: the kit's toast shape, plus where the browser goes next. */
export type RegisterMessage = {
	type: 'success' | 'error';
	text: string;
	/** Chapa's hosted page — a full navigation, not `goto`. */
	checkoutUrl?: string;
	/** The registration's own page, `/reg/<token>`. */
	statusPath?: string;
};

/**
 * Registering for a course (§10 `/school/[slug]/register`, §11 "School"). The guest picks a class
 * from the next `REGISTER_RANGES` date ranges that have a place — each range's shifts side by side,
 * full ones shown but not choosable — then gives their details and pays, all on one page.
 * `?class=<id>` arrives with that class chosen (old links, the course page's buttons).
 */
export const load = async ({ params, url }) => {
	const [course, settings, accounts] = await Promise.all([
		schoolCourse(params.slug),
		getSettings(),
		transferAccounts()
	]);
	if (!course) error(404, 'Course not found');

	const ranges = upcomingRanges(course.intakes);
	const wanted = Number(url.searchParams.get('class'));
	const chosen = ranges
		.flatMap((range) => range.classes)
		.find((c) => c.id === wanted && c.seatsLeft > 0);

	const form = await superValidate<typeof registrationSchema._zod.output, RegisterMessage>(
		zod4(registrationSchema),
		{ errors: false }
	);
	if (chosen) form.data.intakeId = chosen.id;

	return {
		course: {
			slug: course.slug,
			title: course.title,
			titleAm: course.titleAm,
			fee: course.fee,
			days: courseDays(course.durationDays)
		},
		ranges,
		holdMinutes: settings.holdMinutes,
		accounts,
		form
	};
};

export const actions = {
	/**
	 * Takes the seat and starts paying for it: Chapa, or a transfer with its receipt. Thin on
	 * purpose — validation here, the rules in `school` and `payments`.
	 */
	register: async ({ params, request, url, getClientAddress }) => {
		const form = await superValidate<typeof registrationSchema._zod.output, RegisterMessage>(
			request,
			zod4(registrationSchema)
		);

		if (!takeToken(`register:${getClientAddress()}`, { capacity: 8, perMinute: 6 })) {
			return message(form, { type: 'error', text: m.checkout_error_rate() }, { status: 429 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
		}

		const { intakeId, name, email, method, bankAccountId, receipt } = form.data;

		// The class must be one of this course's, and still open: a stale page gets a sentence.
		const intake = await joinableIntake(intakeId);
		if (!intake || intake.courseSlug !== params.slug) {
			setError(form, 'intakeId', m.refused_intake_closed());
			return message(form, { type: 'error', text: m.refused_intake_closed() }, { status: 409 });
		}
		// Validated by the schema already; normalised here into the one stored shape.
		const phone = normalizePhone(form.data.phone)!;

		let created;
		try {
			created = await register({
				intakeId,
				contact: { name, phone, email: email || null, locale: getLocale() },
				sourceId: null
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as 'name', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			console.error('Registration: could not take the seat:', err);
			return message(form, { type: 'error', text: m.reg_error_failed() }, { status: 500 });
		}

		const statusPath = `/reg/${created.token}`;

		if (method === 'transfer') {
			// The seat is held either way. If the receipt does not go through, the customer lands on
			// the registration page, which offers the transfer form (and Chapa) again.
			try {
				const receiptFile = await saveUploadedFile(receipt);
				await submitTransfer('registration', created.id, {
					bankAccountId: bankAccountId!,
					receiptFile
				});
			} catch (err) {
				if (!(err instanceof WriteRefused))
					console.error(`Registration: receipt for ${created.id}:`, err);
				return message(form, {
					type: 'error',
					text: err instanceof WriteRefused ? err.message : m.checkout_error_receipt_upload(),
					statusPath
				});
			}
			return message(form, { type: 'success', text: m.reg_placed_transfer(), statusPath });
		}

		try {
			const checkoutUrl = await startChapa('registration', created.id, url.origin);
			return message(form, {
				type: 'success',
				text: m.reg_redirecting(),
				checkoutUrl,
				statusPath
			});
		} catch (err) {
			console.error(`Registration: Chapa for ${created.id}:`, err);
			// The seat stands; its page offers a retry and the transfer instead.
			return message(form, {
				type: 'error',
				text: m.order_payment_unavailable(),
				statusPath:
					err instanceof PaymentStartError ? `${statusPath}?payment=unavailable` : statusPath
			});
		}
	}
};
