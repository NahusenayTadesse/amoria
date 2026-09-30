/**
 * The shared payment pipeline (§7). A record becomes paid in exactly one place, `verify` (online)
 * or — later — the staff confirmation of a transfer; both end in the record's `Payable.onPaid`,
 * inside the transaction that marks the payment `success`.
 *
 *   create record (pending_payment + hold) ─► startChapa ─► Chapa checkout
 *        webhook / callback / return page / reconcile job ─► verify(txRef) ─► onPaid, once
 */
import { and, asc, eq, lt } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { bankAccount, payment } from '$lib/server/db/schema';
import { newTxRef } from '$lib/server/tokens';
import { cached } from '$lib/server/cache';
import { orderPayable } from '../orders';
import { registrationPayable } from '../school';
import { initializeTransaction, verifyTransaction } from './chapa';
import type { Actor, Payable, PayableKind } from './payable';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { m } from '$lib/paraglide/messages.js';

/** Implemented so far. Rentals and quotes register here as they are built. */
const PAYABLES: Partial<Record<PayableKind, Payable>> = {
	order: orderPayable,
	registration: registrationPayable
};

/** The payment column that points at each kind of record. */
const RECORD_COLUMN = {
	order: 'orderId',
	rental: 'rentalBookingId',
	quote_deposit: 'quoteId',
	quote_balance: 'quoteId',
	registration: 'registrationId'
} as const;

const TX_PREFIX = {
	order: 'o',
	rental: 'r',
	quote_deposit: 'qd',
	quote_balance: 'qb',
	registration: 's'
} as const;

/** Money comparisons get a cent of slack for decimal round-tripping. */
const AMOUNT_TOLERANCE = 0.01;

function payableFor(kind: PayableKind): Payable {
	const payable = PAYABLES[kind];
	if (!payable) throw new Error(`No Payable registered for ${kind}`);
	return payable;
}

/** Chapa could not start the checkout. The record stands; the status page offers a retry or a transfer. */
export class PaymentStartError extends Error {
	constructor(
		readonly statusPath: string,
		cause: unknown
	) {
		super(cause instanceof Error ? cause.message : 'Could not start the payment', { cause });
		this.name = 'PaymentStartError';
	}
}

/**
 * Starts a Chapa attempt for a record and returns the checkout URL. Each call is a new attempt
 * with its own `txRef`; older attempts can still settle (a customer who paid on an old tab has
 * paid), and `onPaid` copes with a second success.
 *
 * The payment row is written before the customer leaves for Chapa, so a webhook that beats them
 * back can already be matched.
 */
export async function startChapa(kind: PayableKind, id: number, origin: string): Promise<string> {
	const payable = payableFor(kind);

	const attempt = await transaction(async (tx) => {
		const state = await payable.lockForPayment(tx, id);
		if (!state) throw new WriteRefused(null, m.refused_not_found());
		if (!state.canPay) throw new WriteRefused(null, state.reason ?? m.refused_expired());

		const txRef = newTxRef(TX_PREFIX[kind], id);
		await tx.insert(payment).values({
			txRef,
			provider: 'chapa',
			purpose: kind,
			[RECORD_COLUMN[kind]]: id,
			amount: state.amountDue,
			status: 'initiated'
		});
		return { txRef, state };
	});

	const statusPath = payable.statusPath(attempt.state.token);
	try {
		const checkoutUrl = await initializeTransaction({
			amount: attempt.state.amountDue,
			name: attempt.state.contact.name,
			email: attempt.state.contact.email,
			phone: attempt.state.contact.phone,
			txRef: attempt.txRef,
			callbackUrl: `${origin}/api/payments/chapa/callback`,
			returnUrl: `${origin}/pay/return?tx_ref=${encodeURIComponent(attempt.txRef)}`,
			description: attempt.state.description
		});
		await db.update(payment).set({ checkoutUrl }).where(eq(payment.txRef, attempt.txRef));
		return checkoutUrl;
	} catch (err) {
		await db
			.update(payment)
			.set({
				status: 'failed',
				verifyPayload: err instanceof Error ? err.message.slice(0, 2000) : null
			})
			.where(and(eq(payment.txRef, attempt.txRef), eq(payment.status, 'initiated')));
		throw new PaymentStartError(statusPath, err);
	}
}

export type VerifyOutcome =
	| { status: 'paid'; statusPath: string | null }
	| { status: 'failed'; statusPath: string | null }
	/** `retryable`: asking again later could change the answer (Chapa unreachable, not finished). */
	| { status: 'pending'; statusPath: string | null; retryable: boolean };

/**
 * Asks Chapa about one attempt and, if it genuinely went through, marks the payment `success` and
 * calls `onPaid` — exactly once, however many callers race here (webhook, callback, return page,
 * reconcile job): the claim is a conditional `UPDATE … WHERE status = 'initiated'`, and only the
 * caller that changes the row runs `onPaid`.
 *
 * The answer is held to what we asked for: our reference, ETB, and at least the amount.
 */
export async function verify(txRef: string): Promise<VerifyOutcome> {
	const [row] = await db.select().from(payment).where(eq(payment.txRef, txRef));
	if (!row || row.provider !== 'chapa')
		return { status: 'pending', statusPath: null, retryable: false };

	const payable = payableFor(row.purpose);
	const recordId = row[RECORD_COLUMN[row.purpose]]!;
	const statusPath = await pathFor(payable, recordId);

	if (row.status === 'success') return { status: 'paid', statusPath };
	if (row.status !== 'initiated') return { status: 'failed', statusPath };

	let result;
	try {
		result = await verifyTransaction(txRef);
	} catch (err) {
		console.error(`Chapa verify failed for ${txRef}:`, err);
		return { status: 'pending', statusPath, retryable: true };
	}

	if (!result.paid) {
		if (result.failed) {
			await db
				.update(payment)
				.set({ status: 'failed', verifyPayload: result.raw })
				.where(and(eq(payment.id, row.id), eq(payment.status, 'initiated')));
			return { status: 'failed', statusPath };
		}
		return { status: 'pending', statusPath, retryable: true };
	}

	const mismatch =
		(result.txRef && result.txRef !== txRef && 'reference') ||
		(result.currency && result.currency !== 'ETB' && 'currency') ||
		((!Number.isFinite(result.amount) || result.amount + AMOUNT_TOLERANCE < row.amount) &&
			'amount');
	if (mismatch) {
		// Paid, but not what we asked for. Never settled automatically; staff look at it.
		console.error(`Chapa ${mismatch} mismatch on ${txRef}: ${result.raw}`);
		return { status: 'pending', statusPath, retryable: false };
	}

	await transaction(async (tx) => {
		const [claim] = await tx
			.update(payment)
			.set({
				status: 'success',
				verifiedAt: new Date(),
				providerRef: result.reference ?? null,
				verifyPayload: result.raw
			})
			.where(and(eq(payment.id, row.id), eq(payment.status, 'initiated')));
		if (claim.affectedRows !== 1) return; // Another caller got here first.

		await payable.onPaid(tx, recordId, { ...row, status: 'success' });
	});

	return { status: 'paid', statusPath };
}

async function pathFor(payable: Payable, id: number) {
	return transaction(async (tx) => {
		const state = await payable.lockForPayment(tx, id);
		return state ? payable.statusPath(state.token) : null;
	});
}

/** The accounts a customer can transfer to, for the checkout and status pages. */
export function transferAccounts() {
	return cached('bank-accounts', { ttlMs: 5 * 60_000, tags: ['settings'] }, () =>
		db
			.select({
				id: bankAccount.id,
				bankName: bankAccount.bankName,
				accountName: bankAccount.accountName,
				accountNumber: bankAccount.accountNumber
			})
			.from(bankAccount)
			.where(and(eq(bankAccount.status, true), notDeleted(bankAccount)))
			.orderBy(asc(bankAccount.sortOrder), asc(bankAccount.id))
	);
}

/**
 * Records a transfer the customer says they made, with their receipt. The payment stays
 * `initiated` — the money is confirmed only when staff check the receipt against the statement —
 * and the record is held for review so its hold cannot run out under a customer who has paid.
 */
export async function submitTransfer(
	kind: PayableKind,
	id: number,
	{ bankAccountId, receiptFile }: { bankAccountId: number; receiptFile: string }
) {
	const payable = payableFor(kind);
	const accounts = await transferAccounts();
	if (!accounts.some((account) => account.id === bankAccountId)) {
		throw new WriteRefused('bankAccountId', m.refused_account());
	}

	await transaction(async (tx) => {
		const state = await payable.lockForPayment(tx, id);
		if (!state) throw new WriteRefused(null, m.refused_not_found());
		if (!state.canPay) throw new WriteRefused(null, state.reason ?? m.refused_expired());

		await tx.insert(payment).values({
			txRef: newTxRef(TX_PREFIX[kind], id),
			provider: 'bank_transfer',
			purpose: kind,
			[RECORD_COLUMN[kind]]: id,
			amount: state.amountDue,
			status: 'initiated',
			bankAccountId,
			receiptFile
		});
		await payable.holdForReview(tx, id);
	});
}

/**
 * Verifies Chapa attempts nobody came back for (job `reconcile-payments`): `initiated` and older
 * than ten minutes. Bounded per run.
 */
export async function reconcileStale(limit = 20): Promise<number> {
	const stale = await db
		.select({ txRef: payment.txRef })
		.from(payment)
		.where(
			and(
				eq(payment.provider, 'chapa'),
				eq(payment.status, 'initiated'),
				lt(payment.createdAt, new Date(Date.now() - 10 * 60_000))
			)
		)
		.orderBy(asc(payment.id))
		.limit(limit);

	let settled = 0;
	for (const { txRef } of stale) {
		const outcome = await verify(txRef);
		if (outcome.status === 'paid') settled++;
		// Still not paid after the checkout could have finished: Chapa sessions don't outlive this.
		if (outcome.status === 'pending' && outcome.retryable) {
			await db
				.update(payment)
				.set({ status: 'cancelled' })
				.where(
					and(
						eq(payment.txRef, txRef),
						eq(payment.status, 'initiated'),
						lt(payment.createdAt, new Date(Date.now() - 24 * 60 * 60_000))
					)
				);
		}
	}
	return settled;
}

/**
 * Staff checked a transfer receipt against the statement and the money is there: the payment
 * becomes `success` and the record is paid, in one transaction (§7 "Manual payments").
 */
export async function confirmTransfer(paymentId: number, actor: Actor) {
	await transaction(async (tx) => {
		const [row] = await tx.select().from(payment).where(eq(payment.id, paymentId)).for('update');
		if (!row || row.provider !== 'bank_transfer')
			throw new WriteRefused(null, 'That is not a transfer receipt.');
		if (row.status !== 'initiated')
			throw new WriteRefused(null, 'This receipt has already been dealt with.');

		const now = new Date();
		await tx
			.update(payment)
			.set({ status: 'success', verifiedAt: now, recordedBy: actor.locals.user?.id ?? null })
			.where(eq(payment.id, paymentId));
		await payableFor(row.purpose).onPaid(tx, row[RECORD_COLUMN[row.purpose]]!, {
			...row,
			status: 'success',
			verifiedAt: now
		});
		await recordAudit(tx, actor, {
			table: 'payment',
			recordId: paymentId,
			action: 'update',
			before: { status: row.status },
			after: { status: 'success' }
		});
	});
}

/**
 * Staff could not match a receipt (wrong amount, not on the statement). The payment is `failed`
 * with the reason, and the record gets a fresh hold so the customer can pay again.
 */
export async function rejectTransfer(paymentId: number, reason: string, actor: Actor) {
	await transaction(async (tx) => {
		const [row] = await tx.select().from(payment).where(eq(payment.id, paymentId)).for('update');
		if (!row || row.provider !== 'bank_transfer')
			throw new WriteRefused(null, 'That is not a transfer receipt.');
		if (row.status !== 'initiated')
			throw new WriteRefused(null, 'This receipt has already been dealt with.');

		await tx
			.update(payment)
			.set({
				status: 'failed',
				verifyPayload: `Rejected: ${reason}`.slice(0, 2000),
				recordedBy: actor.locals.user?.id ?? null
			})
			.where(eq(payment.id, paymentId));
		await payableFor(row.purpose).onPaymentRejected(tx, row[RECORD_COLUMN[row.purpose]]!);
		await recordAudit(tx, actor, {
			table: 'payment',
			recordId: paymentId,
			action: 'update',
			before: { status: row.status },
			after: { status: 'failed' },
			detail: { reason }
		});
	});
}

/**
 * Money staff took in person — cash at the counter, or a transfer they have already seen arrive —
 * recorded as a successful payment for the full amount due, with an optional receipt photo.
 */
export async function recordManualPayment(
	kind: PayableKind,
	id: number,
	input: {
		provider: 'cash' | 'bank_transfer' | 'telebirr';
		reference: string | null;
		receiptFile: string | null;
	},
	actor: Actor
) {
	const payable = payableFor(kind);
	await transaction(async (tx) => {
		const state = await payable.lockForPayment(tx, id);
		if (!state) throw new WriteRefused(null, 'We could not find that record.');
		if (!state.canPay) throw new WriteRefused(null, state.reason ?? 'This can no longer be paid.');

		const now = new Date();
		const txRef = newTxRef(TX_PREFIX[kind], id);
		const values = {
			txRef,
			provider: input.provider,
			providerRef: input.reference,
			purpose: kind,
			[RECORD_COLUMN[kind]]: id,
			amount: state.amountDue,
			status: 'success' as const,
			verifiedAt: now,
			receiptFile: input.receiptFile,
			recordedBy: actor.locals.user?.id ?? null
		};
		await tx.insert(payment).values(values);
		const [row] = await tx.select().from(payment).where(eq(payment.txRef, txRef));
		await payable.onPaid(tx, id, row);
		await recordAudit(tx, actor, { table: 'payment', recordId: row.id, action: 'create' });
	});
}
