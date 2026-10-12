import { and, asc, count, eq, gte, inArray } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { localToday } from '@nahu/admin-kit/time';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { saveUploadedFile } from '@nahu/admin-kit/server/files';
import { db } from '$lib/server/db';
import { renterBankAccount, renterListing, renterOrder } from '$lib/server/db/schema';
import { currentRenter, renterActor } from '$lib/server/renterArea';
import { resubmitDocuments } from '$lib/server/services/renters';
import { formAttempt } from '$lib/server/attempt';
import { renterDocumentsSchema } from '$lib/schemas/renters';

/**
 * The renter's overview: where their business stands with Amoria, what needs them now (requests to
 * price, receipts to check, hand-overs coming up), and the steps to a first booking.
 */
export const load = async ({ locals }) => {
	const renter = await currentRenter(locals);
	const today = localToday();

	const [byStatus, listings, [{ accounts }], upcoming] = await Promise.all([
		db
			.select({ status: renterOrder.status, n: count() })
			.from(renterOrder)
			.where(eq(renterOrder.renterId, renter.id))
			.groupBy(renterOrder.status),
		db
			.select({ status: renterListing.status, n: count() })
			.from(renterListing)
			.where(and(eq(renterListing.renterId, renter.id), notDeleted(renterListing)))
			.groupBy(renterListing.status),
		db
			.select({ accounts: count() })
			.from(renterBankAccount)
			.where(
				and(
					eq(renterBankAccount.renterId, renter.id),
					eq(renterBankAccount.status, true),
					notDeleted(renterBankAccount)
				)
			),
		db
			.select({
				id: renterOrder.id,
				ref: renterOrder.ref,
				title: renterOrder.titleSnapshot,
				contactName: renterOrder.contactName,
				startDate: renterOrder.startDate,
				endDate: renterOrder.endDate,
				qty: renterOrder.qty,
				status: renterOrder.status
			})
			.from(renterOrder)
			.where(
				and(
					eq(renterOrder.renterId, renter.id),
					inArray(renterOrder.status, ['confirmed', 'out']),
					gte(renterOrder.endDate, today)
				)
			)
			.orderBy(asc(renterOrder.startDate))
			.limit(8)
	]);

	const orders = (status: string) => Number(byStatus.find((r) => r.status === status)?.n ?? 0);
	const listed = (status: string) => Number(listings.find((r) => r.status === status)?.n ?? 0);

	return {
		counts: {
			requests: orders('quote_requested'),
			receipts: orders('payment_review'),
			awaiting: orders('pending_payment') + orders('quoted'),
			completed: orders('completed'),
			live: listed('approved'),
			inReview: listed('pending_review'),
			changesNeeded: listed('rejected'),
			listings: listings.reduce((total, r) => total + Number(r.n), 0)
		},
		setup: {
			profile: Boolean(renter.logoFile && renter.about),
			accounts: Number(accounts) > 0,
			listing: listings.length > 0
		},
		upcoming,
		documentsForm: await superValidate(zod4(renterDocumentsSchema))
	};
};

export const actions = {
	/** Turned down: new papers, back in the queue. */
	resubmit: async (event) => {
		const renter = await currentRenter(event.locals);
		const form = await superValidate(event.request, zod4(renterDocumentsSchema));
		const licence = form.data.tradeLicence;
		// A file cannot travel back in the answer.
		form.data.tradeLicence = undefined as unknown as File;
		return formAttempt(
			form,
			async () =>
				resubmitDocuments(renterActor(event), renter.id, {
					tinNumber: form.data.tinNumber,
					tradeLicenceFile: await saveUploadedFile(licence)
				}),
			'Sent. Amoria will look at your papers again.'
		);
	}
};
