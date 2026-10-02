import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { saveUploadedFile } from '@nahu/admin-kit/server/files';
import { db } from '$lib/server/db';
import { bankAccount, payment, user } from '$lib/server/db/schema';
import {
	confirmTransfer,
	recordManualPayment,
	rejectTransfer
} from '$lib/server/services/payments';
import type { Actor, PayableKind } from '$lib/server/services/payments/payable';
import { manualPaymentSchema, paymentIdSchema, rejectReceiptSchema } from '$lib/schemas/dashboard';

/**
 * Staff handling of a record's payments — one implementation for every payable (§7 "Manual
 * payments"): the list on its dashboard page, and the three actions behind `PaymentsCard`.
 */

/** The staff member, for the audit trail. */
export const actorOf = (event: { locals: App.Locals; getClientAddress: () => string }): Actor => ({
	locals: {
		user: event.locals.user ? { id: event.locals.user.id } : null,
		isSuperAdmin: event.locals.isSuperAdmin
	},
	getClientAddress: event.getClientAddress
});

const COLUMN = {
	order: payment.orderId,
	registration: payment.registrationId
} as const;

/** A record's payments, newest first, with the account and the staff member named. */
export async function paymentsFor(kind: keyof typeof COLUMN, id: number) {
	const rows = await db
		.select({
			id: payment.id,
			txRef: payment.txRef,
			provider: payment.provider,
			providerRef: payment.providerRef,
			status: payment.status,
			amount: payment.amount,
			receiptFile: payment.receiptFile,
			verifiedAt: payment.verifiedAt,
			verifyPayload: payment.verifyPayload,
			createdAt: payment.createdAt,
			bankName: bankAccount.bankName,
			accountNumber: bankAccount.accountNumber,
			recordedBy: user.name
		})
		.from(payment)
		.leftJoin(bankAccount, eq(bankAccount.id, payment.bankAccountId))
		.leftJoin(user, eq(user.id, payment.recordedBy))
		.where(eq(COLUMN[kind], id))
		.orderBy(desc(payment.id));

	return rows.map((row) => ({
		...row,
		// Staff see why a payment failed; Chapa's raw JSON is not worth showing.
		note: row.verifyPayload?.startsWith('Rejected: ') ? row.verifyPayload.slice(10) : null,
		verifyPayload: undefined
	}));
}

/** What a dashboard page adds to its `load` to show `PaymentsCard`. */
export async function paymentsCardData(event: { locals: App.Locals }) {
	return {
		canRecord: hasPermission(event.locals, 'payments.record'),
		rejectForm: await superValidate(zod4(rejectReceiptSchema)),
		paymentForm: await superValidate(zod4(manualPaymentSchema))
	};
}

/**
 * The actions `PaymentsCard` posts to: `confirmReceipt`, `rejectReceipt`, `recordPayment`.
 * `noun` is what the record is called in the toasts ("order", "registration").
 */
export function paymentAdminActions<E extends RequestEvent>(options: {
	kind: PayableKind;
	/** The record's id from the page's route params; throws a 404 for a bad one. */
	idOf: (params: Record<string, string | undefined>) => number;
	noun: string;
}) {
	const { kind, idOf, noun } = options;

	return {
		confirmReceipt: async (event: E) => {
			requirePermission(event.locals, 'payments.record');
			const form = await superValidate(event.request, zod4(paymentIdSchema));
			if (!form.valid) return fail(400, { error: 'Which receipt?' });
			try {
				await confirmTransfer(form.data.paymentId, actorOf(event));
			} catch (err) {
				if (err instanceof WriteRefused) return fail(409, { error: err.message });
				throw err;
			}
			return { done: `Receipt confirmed: the ${noun} is paid` };
		},

		rejectReceipt: async (event: E) => {
			requirePermission(event.locals, 'payments.record');
			const form = await superValidate(event.request, zod4(rejectReceiptSchema));
			if (!form.valid)
				return message(
					form,
					{ type: 'error', text: 'Say why the receipt is rejected.' },
					{ status: 400 }
				);
			try {
				await rejectTransfer(form.data.paymentId, form.data.reason, actorOf(event));
			} catch (err) {
				if (err instanceof WriteRefused)
					return message(form, { type: 'error', text: err.message }, { status: 409 });
				throw err;
			}
			return message(form, {
				type: 'success',
				text: 'Receipt rejected. The customer can pay again.'
			});
		},

		recordPayment: async (event: E) => {
			requirePermission(event.locals, 'payments.record');
			const form = await superValidate(event.request, zod4(manualPaymentSchema));
			if (!form.valid)
				return message(
					form,
					{ type: 'error', text: 'Check the payment details.' },
					{ status: 400 }
				);
			try {
				const receiptFile = form.data.receipt?.size
					? await saveUploadedFile(form.data.receipt)
					: null;
				await recordManualPayment(
					kind,
					idOf(event.params),
					{ provider: form.data.provider, reference: form.data.reference || null, receiptFile },
					actorOf(event)
				);
			} catch (err) {
				if (err instanceof WriteRefused)
					return message(form, { type: 'error', text: err.message }, { status: 409 });
				throw err;
			}
			return message(form, { type: 'success', text: `Payment recorded: the ${noun} is paid` });
		}
	};
}
