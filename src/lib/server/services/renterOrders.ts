import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne, or, sql, sum } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import {
	renter,
	renterBankAccount,
	renterListing,
	renterOrder,
	renterPayment
} from '$lib/server/db/schema';
import { publicToken } from '$lib/server/tokens';
import { sumBirr } from '$lib/money';
import {
	fixedPrice,
	HOLDS_UNITS,
	MAX_RENTAL_DAYS,
	rentalDays,
	RENTER_ORDER_MOVES,
	type RenterOrderStatus
} from '$lib/rentalMarket';
import type { OrderInput } from '$lib/schemas/renters';
import { m } from '$lib/paraglide/messages.js';
import { upsertGuest, type GuestDetails } from './customers';
import { getSettings } from './settings';
import { renterAccounts } from './renters';
import type { Actor } from './payments/payable';

/**
 * A customer's bookings and quote requests with a renter (§5.12), from "Book now" or "Ask for a
 * quote" to the hand-back. Money goes straight to the renter's bank account: the customer uploads
 * the receipt here and the renter confirms it, so nothing in Amoria's own payment pipeline (§7)
 * is involved and no amount is ever taken from the client.
 */

export const formatRenterRef = (id: number) => `AM-M-${String(id).padStart(6, '0')}`;

type OrderRow = typeof renterOrder.$inferSelect;

/** A listing a guest can order from: approved, its renter approved, not deleted. Locked. */
async function liveListing(tx: Writer, slug: string) {
	const [row] = await tx
		.select({
			id: renterListing.id,
			renterId: renterListing.renterId,
			name: renterListing.name,
			pricing: renterListing.pricing,
			price: renterListing.price,
			priceUnit: renterListing.priceUnit,
			deposit: renterListing.deposit,
			quantity: renterListing.quantity
		})
		.from(renterListing)
		.innerJoin(renter, and(eq(renter.id, renterListing.renterId), eq(renter.status, 'approved')))
		.where(
			and(
				eq(renterListing.slug, slug),
				eq(renterListing.status, 'approved'),
				notDeleted(renterListing)
			)
		)
		.for('update');
	if (!row) throw new WriteRefused(null, m.market_refused_gone());
	return row;
}

/** Checks the dates as Addis Ababa days: not past, end not before start, not too long. */
function checkDates(input: { startDate: string; endDate: string }) {
	const endDate = input.endDate || input.startDate;
	if (input.startDate < localToday()) throw new WriteRefused('startDate', m.market_refused_past());
	const days = rentalDays(input.startDate, endDate);
	if (days < 1) throw new WriteRefused('endDate', m.market_refused_end_before());
	if (days > MAX_RENTAL_DAYS) {
		throw new WriteRefused('endDate', m.market_refused_too_long({ days: MAX_RENTAL_DAYS }));
	}
	return { startDate: input.startDate, endDate, days };
}

/**
 * Units of a listing already taken over some days: orders that hold them (paid, being checked,
 * out) and bookings still inside their payment hold. The listing row must already be locked, so
 * two customers cannot both take the last one.
 */
async function unitsTaken(
	tx: Writer,
	listingId: number,
	startDate: string,
	endDate: string,
	exceptOrderId?: number
): Promise<number> {
	const [row] = await tx
		.select({ taken: sum(renterOrder.qty) })
		.from(renterOrder)
		.where(
			and(
				eq(renterOrder.listingId, listingId),
				lte(renterOrder.startDate, endDate),
				gte(renterOrder.endDate, startDate),
				or(
					inArray(renterOrder.status, HOLDS_UNITS),
					and(eq(renterOrder.status, 'pending_payment'), gt(renterOrder.holdExpiresAt, sql`NOW()`))
				),
				exceptOrderId ? ne(renterOrder.id, exceptOrderId) : undefined
			)
		);
	return Number(row?.taken ?? 0);
}

async function checkAvailable(
	tx: Writer,
	listing: { id: number; quantity: number },
	dates: { startDate: string; endDate: string },
	qty: number,
	exceptOrderId?: number
) {
	const taken = await unitsTaken(tx, listing.id, dates.startDate, dates.endDate, exceptOrderId);
	const left = listing.quantity - taken;
	if (left < qty) {
		throw new WriteRefused(
			'startDate',
			left <= 0 ? m.market_refused_booked() : m.market_refused_only_left({ count: left })
		);
	}
}

async function holdUntil(): Promise<Date> {
	const { renterHoldHours } = await getSettings();
	return new Date(Date.now() + renterHoldHours * 3_600_000);
}

function baseValues(
	input: OrderInput,
	contact: GuestDetails,
	customerId: number,
	dates: { startDate: string; endDate: string }
) {
	return {
		publicToken: publicToken(),
		customerId,
		contactName: contact.name,
		contactPhone: contact.phone,
		contactEmail: contact.email,
		startDate: dates.startDate,
		endDate: dates.endDate,
		qty: input.qty,
		hours: input.hours ?? null,
		venue: input.venue || null,
		message: input.message || null,
		locale: contact.locale
	};
}

/**
 * "Book now" on a fixed-price listing: the price is read from the locked listing, the units are
 * checked free for the days, and the booking is held for `renterHoldHours` while the customer
 * transfers to the renter. Refused when the renter has no account to transfer to.
 */
export async function bookNow(slug: string, input: OrderInput, contact: GuestDetails) {
	const dates = checkDates(input);
	const hold = await holdUntil();

	return transaction(async (tx) => {
		const listing = await liveListing(tx, slug);
		if (listing.pricing !== 'fixed' || listing.price == null) {
			throw new WriteRefused(null, m.market_refused_quote_only());
		}
		if (!(await renterAccounts(listing.renterId)).length) {
			throw new WriteRefused(null, m.market_refused_no_accounts());
		}
		await checkAvailable(tx, listing, dates, input.qty);

		const price = fixedPrice({
			price: listing.price,
			unit: listing.priceUnit,
			deposit: listing.deposit,
			qty: input.qty,
			days: dates.days,
			hours: input.hours
		});
		const customerId = await upsertGuest(tx, contact);
		const id = await insertReturningId(tx, renterOrder, {
			...baseValues(input, contact, customerId, dates),
			hours: listing.priceUnit === 'hour' ? (input.hours ?? 1) : null,
			renterId: listing.renterId,
			listingId: listing.id,
			origin: 'buy_now',
			titleSnapshot: listing.name,
			priceUnit: listing.priceUnit,
			unitPrice: listing.price,
			subtotal: price.subtotal,
			deposit: price.deposit,
			total: price.total,
			status: 'pending_payment',
			holdExpiresAt: hold
		});
		await tx
			.update(renterOrder)
			.set({ ref: formatRenterRef(id) })
			.where(eq(renterOrder.id, id));
		return tokenOf(tx, id);
	});
}

/**
 * "Ask for a quote": on a listing (any pricing), or on the renter's page with no listing (a custom
 * request). Nothing is held: the renter answers with a price, and the units are checked when the
 * customer accepts it.
 */
export async function askForQuote(
	target: { listingSlug: string } | { renterSlug: string },
	input: OrderInput,
	contact: GuestDetails
) {
	const dates = checkDates(input);

	return transaction(async (tx) => {
		let renterId: number;
		let listingId: number | null = null;
		let title: string;
		if ('listingSlug' in target) {
			const listing = await liveListing(tx, target.listingSlug);
			renterId = listing.renterId;
			listingId = listing.id;
			title = listing.name;
		} else {
			const [row] = await tx
				.select({ id: renter.id })
				.from(renter)
				.where(and(eq(renter.slug, target.renterSlug), eq(renter.status, 'approved')));
			if (!row) throw new WriteRefused(null, m.market_refused_renter_gone());
			renterId = row.id;
			title = 'Custom request';
		}

		const customerId = await upsertGuest(tx, contact);
		const id = await insertReturningId(tx, renterOrder, {
			...baseValues(input, contact, customerId, dates),
			renterId,
			listingId,
			origin: 'quote',
			titleSnapshot: title,
			status: 'quote_requested'
		});
		await tx
			.update(renterOrder)
			.set({ ref: formatRenterRef(id) })
			.where(eq(renterOrder.id, id));
		return tokenOf(tx, id);
	});
}

async function tokenOf(tx: Writer, id: number) {
	const [row] = await tx
		.select({ token: renterOrder.publicToken, ref: renterOrder.ref })
		.from(renterOrder)
		.where(eq(renterOrder.id, id));
	return { id, token: row.token, ref: row.ref! };
}

// ------------------------------------------------------------------ the customer, by token

async function lockByToken(tx: Writer, token: string): Promise<OrderRow> {
	const [row] = await tx
		.select()
		.from(renterOrder)
		.where(eq(renterOrder.publicToken, token))
		.for('update');
	if (!row) throw new WriteRefused(null, m.refused_not_found());
	return row;
}

/** The customer takes the renter's price: the units are checked and the booking held for payment. */
export async function acceptQuote(token: string) {
	const hold = await holdUntil();
	await transaction(async (tx) => {
		const row = await lockByToken(tx, token);
		if (row.status !== 'quoted') throw new WriteRefused(null, m.market_refused_not_quoted());
		if (row.validUntil && row.validUntil < localToday()) {
			throw new WriteRefused(null, m.market_refused_quote_expired());
		}
		if (row.startDate < localToday()) throw new WriteRefused(null, m.market_refused_past());
		if (row.listingId) {
			const [listing] = await tx
				.select({ id: renterListing.id, quantity: renterListing.quantity })
				.from(renterListing)
				.where(eq(renterListing.id, row.listingId))
				.for('update');
			if (listing) await checkAvailable(tx, listing, row, row.qty, row.id);
		}
		await tx
			.update(renterOrder)
			.set({ status: 'pending_payment', acceptedAt: new Date(), holdExpiresAt: hold })
			.where(eq(renterOrder.id, row.id));
	});
}

/** The customer calls it off before paying. */
export async function cancelByCustomer(token: string) {
	await transaction(async (tx) => {
		const row = await lockByToken(tx, token);
		if (!['quote_requested', 'quoted', 'pending_payment'].includes(row.status)) {
			throw new WriteRefused(null, m.market_refused_cannot_cancel());
		}
		await tx
			.update(renterOrder)
			.set({ status: 'cancelled', holdExpiresAt: null })
			.where(eq(renterOrder.id, row.id));
	});
}

/**
 * The customer sends the receipt of their transfer to one of the renter's accounts. The amount on
 * the receipt row is the order's total, never the client's; the booking stays held while the
 * renter checks it.
 */
export async function submitReceipt(
	token: string,
	input: { bankAccountId: number; receiptFile: string }
) {
	await transaction(async (tx) => {
		const row = await lockByToken(tx, token);
		if (row.status !== 'pending_payment' || row.total == null) {
			throw new WriteRefused(
				null,
				row.status === 'payment_review' ? m.market_refused_in_review() : m.refused_expired()
			);
		}
		if (row.holdExpiresAt && row.holdExpiresAt.getTime() < Date.now()) {
			throw new WriteRefused(null, m.refused_expired());
		}
		const [accountRow] = await tx
			.select({ id: renterBankAccount.id })
			.from(renterBankAccount)
			.where(
				and(
					eq(renterBankAccount.id, input.bankAccountId),
					eq(renterBankAccount.renterId, row.renterId),
					eq(renterBankAccount.status, true),
					notDeleted(renterBankAccount)
				)
			);
		if (!accountRow) throw new WriteRefused('bankAccountId', m.refused_account());

		await tx.insert(renterPayment).values({
			orderId: row.id,
			bankAccountId: input.bankAccountId,
			amount: row.total,
			receiptFile: input.receiptFile
		});
		await tx
			.update(renterOrder)
			.set({ status: 'payment_review', holdExpiresAt: null })
			.where(eq(renterOrder.id, row.id));
	});
}

// ------------------------------------------------------------------ the renter

/** The renter's own order, locked; refuses one that is not theirs. */
async function lockOwn(tx: Writer, renterId: number, orderId: number): Promise<OrderRow> {
	const [row] = await tx
		.select()
		.from(renterOrder)
		.where(and(eq(renterOrder.id, orderId), eq(renterOrder.renterId, renterId)))
		.for('update');
	if (!row) throw new WriteRefused(null, 'That order was not found.');
	return row;
}

function mayMove(from: RenterOrderStatus, to: RenterOrderStatus) {
	if (!RENTER_ORDER_MOVES[from].includes(to)) {
		throw new WriteRefused(
			null,
			`An order that is "${from.replaceAll('_', ' ')}" cannot go there.`
		);
	}
}

/** Only approved renters may act on orders (a suspended one is locked out). */
async function activeRenter(tx: Writer, renterId: number) {
	const [row] = await tx
		.select({ status: renter.status })
		.from(renter)
		.where(eq(renter.id, renterId));
	if (row?.status !== 'approved') {
		throw new WriteRefused(null, 'Your account is not active. Contact Amoria.');
	}
}

/**
 * The renter answers a request with a price for the whole of it (and any deposit), valid until a
 * day they choose. A quote can be sent again to change it, until the customer accepts.
 */
export async function sendQuote(
	actor: Actor,
	renterId: number,
	orderId: number,
	input: { subtotal: number; deposit: number; validUntil: string; note: string }
) {
	if (input.validUntil < localToday()) {
		throw new WriteRefused('validUntil', 'Choose today or a later day.');
	}
	await transaction(async (tx) => {
		await activeRenter(tx, renterId);
		const row = await lockOwn(tx, renterId, orderId);
		mayMove(row.status, 'quoted');
		if (!(await renterAccounts(renterId)).length) {
			throw new WriteRefused(
				null,
				'Add a bank account first: the customer pays you by transfer to it.'
			);
		}
		const values = {
			subtotal: input.subtotal,
			deposit: input.deposit,
			total: sumBirr([input.subtotal, input.deposit]),
			validUntil: input.validUntil,
			renterNote: input.note || null,
			quotedAt: new Date(),
			status: 'quoted' as const
		};
		await tx.update(renterOrder).set(values).where(eq(renterOrder.id, orderId));
		await recordAudit(tx, actor, {
			table: 'renter_order',
			recordId: orderId,
			action: 'update',
			before: { status: row.status, total: row.total },
			after: { status: 'quoted', total: values.total }
		});
	});
}

/**
 * The renter moves an order on: decline a request, cancel, hand over (`out`) or finish
 * (`completed`). Declining and cancelling need a reason, which the customer reads.
 */
export async function moveOrder(
	actor: Actor,
	renterId: number,
	orderId: number,
	to: 'declined' | 'cancelled' | 'out' | 'completed',
	reason: string | null
) {
	if ((to === 'declined' || to === 'cancelled') && !reason) {
		throw new WriteRefused('reason', 'Say why, for the customer.');
	}
	await transaction(async (tx) => {
		await activeRenter(tx, renterId);
		const row = await lockOwn(tx, renterId, orderId);
		mayMove(row.status, to);
		await tx
			.update(renterOrder)
			.set({
				status: to,
				holdExpiresAt: null,
				...(reason ? { renterNote: reason } : {})
			})
			.where(eq(renterOrder.id, orderId));
		await recordAudit(tx, actor, {
			table: 'renter_order',
			recordId: orderId,
			action: 'update',
			before: { status: row.status },
			after: { status: to },
			...(reason ? { detail: { reason } } : {})
		});
	});
}

/** The receipt, locked, with its order — both the renter's. */
async function lockOwnPayment(tx: Writer, renterId: number, paymentId: number) {
	const [row] = await tx
		.select({ payment: renterPayment, order: renterOrder })
		.from(renterPayment)
		.innerJoin(renterOrder, eq(renterOrder.id, renterPayment.orderId))
		.where(and(eq(renterPayment.id, paymentId), eq(renterOrder.renterId, renterId)))
		.for('update');
	if (!row) throw new WriteRefused(null, 'That receipt was not found.');
	if (row.payment.status !== 'submitted') {
		throw new WriteRefused(null, 'This receipt has already been dealt with.');
	}
	return row;
}

/** The money is in the renter's account: the receipt is accepted and the booking confirmed. */
export async function acceptReceipt(actor: Actor, renterId: number, paymentId: number) {
	await transaction(async (tx) => {
		await activeRenter(tx, renterId);
		const { payment, order } = await lockOwnPayment(tx, renterId, paymentId);
		const now = new Date();
		await tx
			.update(renterPayment)
			.set({ status: 'accepted', reviewedAt: now })
			.where(eq(renterPayment.id, payment.id));
		if (order.status === 'payment_review') {
			await tx
				.update(renterOrder)
				.set({ status: 'confirmed', paidAt: now })
				.where(eq(renterOrder.id, order.id));
		}
		await recordAudit(tx, actor, {
			table: 'renter_payment',
			recordId: payment.id,
			action: 'update',
			before: { status: 'submitted' },
			after: { status: 'accepted' }
		});
	});
}

/**
 * The receipt does not match (not on the statement, wrong amount): turned down with the reason,
 * and the customer gets a fresh hold to pay again.
 */
export async function rejectReceipt(
	actor: Actor,
	renterId: number,
	paymentId: number,
	reason: string
) {
	const hold = await holdUntil();
	await transaction(async (tx) => {
		await activeRenter(tx, renterId);
		const { payment, order } = await lockOwnPayment(tx, renterId, paymentId);
		await tx
			.update(renterPayment)
			.set({ status: 'rejected', reviewNote: reason, reviewedAt: new Date() })
			.where(eq(renterPayment.id, payment.id));
		if (order.status === 'payment_review') {
			await tx
				.update(renterOrder)
				.set({ status: 'pending_payment', holdExpiresAt: hold })
				.where(eq(renterOrder.id, order.id));
		}
		await recordAudit(tx, actor, {
			table: 'renter_payment',
			recordId: payment.id,
			action: 'update',
			before: { status: 'submitted' },
			after: { status: 'rejected' },
			detail: { reason }
		});
	});
}

// ------------------------------------------------------------------ reads and the job

/** One order by its link, with its renter, accounts to pay into, and receipts sent. */
export async function renterOrderByToken(token: string) {
	const [row] = await db
		.select({
			order: renterOrder,
			renter: {
				id: renter.id,
				slug: renter.slug,
				businessName: renter.businessName,
				businessNameAm: renter.businessNameAm,
				logoFile: renter.logoFile,
				phone: renter.phone,
				whatsapp: renter.whatsapp,
				telegram: renter.telegram,
				policies: renter.policies,
				policiesAm: renter.policiesAm
			},
			listingSlug: renterListing.slug
		})
		.from(renterOrder)
		.innerJoin(renter, eq(renter.id, renterOrder.renterId))
		.leftJoin(renterListing, eq(renterListing.id, renterOrder.listingId))
		.where(eq(renterOrder.publicToken, token));
	if (!row) return null;
	const payments = await db
		.select({
			id: renterPayment.id,
			amount: renterPayment.amount,
			status: renterPayment.status,
			reviewNote: renterPayment.reviewNote,
			createdAt: renterPayment.createdAt,
			bankName: renterBankAccount.bankName
		})
		.from(renterPayment)
		.innerJoin(renterBankAccount, eq(renterBankAccount.id, renterPayment.bankAccountId))
		.where(eq(renterPayment.orderId, row.order.id))
		.orderBy(desc(renterPayment.id));
	return { ...row, payments };
}

/** An order's receipts for the renter's page (and staff's), newest first. */
export function receiptsFor(orderId: number) {
	return db
		.select({
			id: renterPayment.id,
			amount: renterPayment.amount,
			status: renterPayment.status,
			receiptFile: renterPayment.receiptFile,
			reviewNote: renterPayment.reviewNote,
			createdAt: renterPayment.createdAt,
			bankName: renterBankAccount.bankName,
			accountNumber: renterBankAccount.accountNumber
		})
		.from(renterPayment)
		.innerJoin(renterBankAccount, eq(renterBankAccount.id, renterPayment.bankAccountId))
		.where(eq(renterPayment.orderId, orderId))
		.orderBy(desc(renterPayment.id));
}

/** Whether a stored file is a receipt sent to this renter (their private file route). */
export async function isRenterReceipt(renterId: number, fileName: string): Promise<boolean> {
	const [row] = await db
		.select({ id: renterPayment.id })
		.from(renterPayment)
		.innerJoin(renterOrder, eq(renterOrder.id, renterPayment.orderId))
		.where(and(eq(renterPayment.receiptFile, fileName), eq(renterOrder.renterId, renterId)))
		.limit(1);
	return Boolean(row);
}

/**
 * Job `expire-holds` (§9): bookings whose payment hold ran out are `expired`, which frees their
 * units, and quotes nobody accepted in time are `expired` too. Bounded per run.
 */
export async function expireRenterOrders(limit = 50): Promise<number> {
	const due = await db
		.select({ id: renterOrder.id })
		.from(renterOrder)
		.where(
			or(
				and(eq(renterOrder.status, 'pending_payment'), lt(renterOrder.holdExpiresAt, sql`NOW()`)),
				and(eq(renterOrder.status, 'quoted'), lt(renterOrder.validUntil, localToday()))
			)
		)
		.orderBy(asc(renterOrder.id))
		.limit(limit);

	let expired = 0;
	for (const { id } of due) {
		// Re-checked under the update's own condition: a receipt sent meanwhile wins.
		const [result] = await db
			.update(renterOrder)
			.set({ status: 'expired', holdExpiresAt: null })
			.where(
				and(
					eq(renterOrder.id, id),
					or(
						and(
							eq(renterOrder.status, 'pending_payment'),
							lt(renterOrder.holdExpiresAt, sql`NOW()`)
						),
						and(eq(renterOrder.status, 'quoted'), lt(renterOrder.validUntil, localToday()))
					)
				)
			);
		expired += result.affectedRows;
	}
	return expired;
}
