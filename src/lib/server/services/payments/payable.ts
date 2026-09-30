import type { Writer } from '@nahu/admin-kit/server/db';
import type { PAYMENT_PURPOSES } from '$lib/constants';
import type { payment } from '$lib/server/db/schema';

export type PayableKind = (typeof PAYMENT_PURPOSES)[number];
export type PaymentRow = typeof payment.$inferSelect;

/** What the payment pipeline needs to know about a record, read with its row locked. */
export type PayableState = {
	id: number;
	/** The public token, for the status page Chapa returns the customer to. */
	token: string;
	ref: string | null;
	/** Birr still owed. Always from the database, never from the client. */
	amountDue: number;
	/** `false` once paid, expired or cancelled: no new attempt may start. */
	canPay: boolean;
	/** Why not, when `canPay` is false — shown to the customer. */
	reason?: string;
	contact: { name: string; phone: string; email: string | null };
	/** One line for Chapa's checkout page, e.g. "Order AM-O-000123". */
	description: string;
};

/**
 * Every sellable record implements this (§7). Adding a fifth sellable thing means writing one of
 * these and registering it in `payments/index.ts`; nothing else in the pipeline changes.
 */
export interface Payable {
	kind: PayableKind;
	/** The status-page path for a token: `/o/<token>`. */
	statusPath(token: string): string;
	/** The record, locked `FOR UPDATE` in `tx`, or null if there is no such id. */
	lockForPayment(tx: Writer, id: number): Promise<PayableState | null>;
	/**
	 * A verified payment. Runs once per successful payment, inside the transaction that marked the
	 * payment `success`. Must handle a record that has meanwhile expired (late payment, §7).
	 */
	onPaid(tx: Writer, id: number, payment: PaymentRow): Promise<void>;
	/**
	 * A transfer receipt was submitted: keep the record held while staff check it, rather than
	 * letting the hold run out under a customer who has paid.
	 */
	holdForReview(tx: Writer, id: number): Promise<void>;
	/**
	 * Staff rejected a transfer receipt: give the customer a fresh hold to pay again, as long as
	 * the record is still waiting for payment.
	 */
	onPaymentRejected(tx: Writer, id: number): Promise<void>;
}

/**
 * The staff member doing something, for the audit trail — the shape the kit's `recordAudit`
 * reads. Services take this rather than a whole `RequestEvent` (§6).
 */
export type Actor = {
	locals: { user?: { id: string } | null };
	getClientAddress: () => string;
};
