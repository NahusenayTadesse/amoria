import { error } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages.js';
import { registrationByToken } from '$lib/server/services/school';
import { verify } from '$lib/server/services/payments';
import { payActions, payPanelData } from '$lib/server/paymentActions';
import { getSettings, publicContact } from '$lib/server/services/settings';

/**
 * A registration's own page (§10 `/reg/[token]`). Reachable by anyone holding the link, so it shows
 * what the student needs and nothing more: no email, and the phone only as the number we will call.
 */
export const load = async ({ params, url }) => {
	let found = await registrationByToken(params.token);
	if (!found) error(404, 'Registration not found');

	// Coming back from Chapa, or checking again: ask about the newest online attempt still open.
	// `verify` is idempotent, so a reload costs one call to Chapa at most.
	const open = found.payments.find((p) => p.provider === 'chapa' && p.status === 'initiated');
	if (open && found.registration.status === 'pending_payment') {
		const outcome = await verify(open.txRef);
		if (outcome.status !== 'pending') found = (await registrationByToken(params.token))!;
	}

	const { registration, payments } = found;
	const inReview =
		registration.status === 'pending_payment' &&
		payments.some((p) => p.provider === 'bank_transfer' && p.status === 'initiated');

	return {
		registration: {
			ref: registration.ref ?? String(registration.id),
			status: registration.status,
			inReview,
			fee: registration.feeSnapshot,
			phone: registration.contactPhone,
			createdAt: registration.createdAt,
			holdExpiresAt: registration.holdExpiresAt,
			/** Graduated with a certificate: the page links to it. */
			graduated: registration.result === 'graduated' && Boolean(registration.certificateIssuedAt)
		},
		course: {
			slug: found.courseSlug,
			title: found.courseTitle,
			titleAm: found.courseTitleAm,
			startDate: found.startDate,
			endDate: found.endDate,
			scheduleText: found.scheduleText,
			shiftName: found.shiftName,
			shiftNameAm: found.shiftNameAm,
			shiftTime: found.shiftTime
		},
		token: params.token,
		/** `?payment=` from the return trip: paid, failed, pending or unavailable. */
		paymentNotice: url.searchParams.get('payment'),
		contact: publicContact(await getSettings()),
		...(await payPanelData(registration.status === 'pending_payment' && !inReview))
	};
};

export const actions = payActions({
	kind: 'registration',
	find: async (token) => {
		const found = await registrationByToken(token);
		return found ? { id: found.registration.id } : null;
	},
	statusPath: (token) => `/reg/${token}`,
	receiptReceived: () => m.reg_receipt_received(),
	notFound: 'Registration not found'
});
