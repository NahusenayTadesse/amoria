import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveUploadedFile } from '@nahu/admin-kit/server/files';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localizeHref } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';
import { transferSchema } from '$lib/schemas/checkout';
import {
	PaymentStartError,
	startChapa,
	submitTransfer,
	transferAccounts
} from '$lib/server/services/payments';
import type { PayableKind } from '$lib/server/services/payments/payable';
import { takeToken } from '$lib/server/rateLimit';

/**
 * The two ways a guest pays from a record's own status page — Chapa, or a bank transfer with its
 * receipt — as form actions, so `/o/[token]` and `/reg/[token]` (and the pages to come) share one
 * implementation and differ only in what they call the record.
 *
 *     export const actions = payActions({ kind: 'registration', find: …, statusPath: …, … });
 */
export function payActions(options: {
	kind: PayableKind;
	/** The record's id for a token, or null. */
	find: (token: string) => Promise<{ id: number } | null>;
	/** The record's own page, `/reg/<token>`. */
	statusPath: (token: string) => string;
	/** Said after a receipt is saved. */
	receiptReceived: () => string;
	notFound: string;
}) {
	const { kind, find, statusPath } = options;

	return {
		/** A new Chapa attempt. A plain form post, so it works without JavaScript: 303 to Chapa. */
		pay: async ({ params, url, getClientAddress }: RequestEvent<{ token: string }>) => {
			if (!takeToken(`pay:${getClientAddress()}`, { capacity: 6, perMinute: 6 })) {
				return fail(429, { error: m.order_error_rate() });
			}
			const found = await find(params.token);
			if (!found) error(404, options.notFound);

			let checkoutUrl: string;
			try {
				checkoutUrl = await startChapa(kind, found.id, url.origin);
			} catch (err) {
				if (err instanceof WriteRefused) return fail(409, { error: err.message });
				if (err instanceof PaymentStartError) {
					redirect(303, localizeHref(`${statusPath(params.token)}?payment=unavailable`));
				}
				throw err;
			}
			redirect(303, checkoutUrl);
		},

		/** Paid by transfer instead: the receipt, for staff to check. */
		transfer: async ({ params, request, getClientAddress }: RequestEvent<{ token: string }>) => {
			const form = await superValidate(request, zod4(transferSchema));
			if (!takeToken(`pay:${getClientAddress()}`, { capacity: 6, perMinute: 6 })) {
				return message(form, { type: 'error', text: m.order_error_rate() }, { status: 429 });
			}
			if (!form.valid) {
				return message(form, { type: 'error', text: m.checkout_error_form() }, { status: 400 });
			}

			const found = await find(params.token);
			if (!found) error(404, options.notFound);

			try {
				const receiptFile = await saveUploadedFile(form.data.receipt);
				await submitTransfer(kind, found.id, {
					bankAccountId: form.data.bankAccountId,
					receiptFile
				});
			} catch (err) {
				if (err instanceof WriteRefused) {
					return message(form, { type: 'error', text: err.message }, { status: 409 });
				}
				console.error(`Transfer receipt for ${kind} ${found.id}:`, err);
				return message(
					form,
					{ type: 'error', text: m.checkout_error_receipt_upload() },
					{ status: 500 }
				);
			}

			return message(form, { type: 'success', text: options.receiptReceived() });
		}
	};
}

/** What a status page's `load` adds for paying: the accounts (when it can still be paid) and the form. */
export async function payPanelData(canPay: boolean) {
	return {
		accounts: canPay ? await transferAccounts() : [],
		transferForm: await superValidate(zod4(transferSchema))
	};
}
