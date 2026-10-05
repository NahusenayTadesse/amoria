import { and, asc, desc, eq, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { notifyOrder, type OrderEvent } from './push';
import type { Writer } from '@nahu/admin-kit/server/db';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { bankAccount, orderItem, orders, payment, product } from '$lib/server/db/schema';
import { formatRef, publicToken } from '$lib/server/tokens';
import { invalidate } from '$lib/server/cache';
import { lineTotal, sumBirr } from '$lib/money';
import { upsertGuest, type GuestDetails } from './customers';
import { move, StockShortError } from './stock';
import { getSettings } from './settings';
import { quoteDelivery } from './delivery';
import type { Actor, Payable, PayableState, PaymentRow } from './payments/payable';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { HOLDS_STOCK, ORDER_TRANSITIONS, type OrderStatus } from '$lib/orderStatus';
import { m } from '$lib/paraglide/messages.js';

/** Orders a customer has not paid for yet, and that can still be paid. */
const PAYABLE_STATUSES = ['pending_payment'] as const;
/** Statuses that mean the money is in. A second payment against one of these changes nothing. */
const PAID_STATUSES = ['paid', 'preparing', 'ready', 'completed', 'paid_unfulfillable'];

/** The most lines one order may have (§5.3), and the most of one item. */
export const MAX_CART_LINES = 20;
export const MAX_LINE_QTY = 20;

export type CartLine = { productId: number; qty: number };

export type Fulfilment =
	| { type: 'pickup' }
	/** `address` is what the customer typed; the area's fee comes from the database. */
	| { type: 'delivery'; areaId: number; address: string };

export type NewOrder = {
	lines: CartLine[];
	contact: GuestDetails;
	fulfilment: Fulfilment;
	notes: string | null;
	sourceId: number | null;
};

/**
 * Places a gift order from the posted cart (§5.3, §11 "Gift direct-buy").
 *
 * Nothing the browser computed is used: every price is re-read, and every product is locked and
 * its stock taken (`sale` movements) in the same transaction as the order, so two customers
 * buying the last one cannot both get it. The order is held for `holdMinutes`; `expireHolds`
 * gives the stock back if it is not paid by then.
 *
 * Refuses with `WriteRefused` — a sentence the customer can act on — when an item is gone or
 * short.
 */
export async function createFromCart(input: NewOrder) {
	const lines = mergeLines(input.lines);
	if (!lines.length) throw new WriteRefused(null, m.refused_bag_empty());
	if (lines.length > MAX_CART_LINES) throw new WriteRefused(null, m.refused_too_many());

	const { holdMinutes } = await getSettings();

	const created = await transaction(async (tx) => {
		const products = await tx
			.select({ id: product.id, name: product.name, price: product.price })
			.from(product)
			.where(
				and(
					inArray(
						product.id,
						lines.map((line) => line.productId)
					),
					eq(product.kind, 'gift'),
					eq(product.isActive, true),
					isNotNull(product.price),
					isNotNull(product.publishedAt),
					lte(product.publishedAt, sql`NOW()`),
					notDeleted(product)
				)
			)
			// Locked first, before any plain read, and in id order: a second checkout for the same
			// product waits here and then sees the stock the first one left, instead of failing on a
			// snapshot conflict (MariaDB 11.6+) or deadlocking.
			.orderBy(asc(product.id))
			.for('update');
		const byId = new Map(products.map((p) => [p.id, p]));

		const priced = lines.map((line) => {
			const item = byId.get(line.productId);
			if (!item) throw new WriteRefused(null, m.refused_gone());
			return {
				...line,
				name: item.name,
				unitPrice: item.price!,
				lineTotal: lineTotal(item.price!, line.qty)
			};
		});

		const subtotal = sumBirr(priced.map((line) => line.lineTotal));
		// The fee is decided here from the area's row and the free-delivery threshold, never taken
		// from the form: the sheet's figure is a preview of this same rule (`$lib/delivery`).
		const delivery =
			input.fulfilment.type === 'delivery'
				? {
						...(await quoteDelivery(input.fulfilment.areaId, subtotal)),
						address: input.fulfilment.address
					}
				: null;
		const customerId = await upsertGuest(tx, input.contact);

		const orderId = await insertReturningId(tx, orders, {
			publicToken: publicToken(),
			customerId,
			contactName: input.contact.name,
			contactPhone: input.contact.phone,
			contactEmail: input.contact.email,
			fulfilment: input.fulfilment.type,
			deliveryAreaId: delivery?.areaId ?? null,
			deliveryAreaName: delivery?.areaName ?? null,
			deliveryAddress: delivery?.address ?? null,
			subtotal,
			deliveryFee: delivery?.fee ?? 0,
			total: sumBirr([subtotal, delivery?.fee ?? 0]),
			status: 'pending_payment',
			holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
			sourceId: input.sourceId,
			locale: input.contact.locale,
			notes: input.notes
		});
		await tx
			.update(orders)
			.set({ ref: formatRef('order', orderId) })
			.where(eq(orders.id, orderId));

		await tx.insert(orderItem).values(
			priced.map((line) => ({
				orderId,
				productId: line.productId,
				nameSnapshot: line.name,
				unitPrice: line.unitPrice,
				qty: line.qty,
				lineTotal: line.lineTotal
			}))
		);

		// Ascending ids (see `mergeLines`), so concurrent checkouts lock rows in the same order.
		for (const line of priced) {
			try {
				await move(tx, {
					productId: line.productId,
					delta: -line.qty,
					reason: 'sale',
					refType: 'order',
					refId: orderId
				});
			} catch (err) {
				if (err instanceof StockShortError) {
					throw new WriteRefused(
						null,
						err.available === 0
							? m.refused_sold_out({ name: line.name })
							: m.refused_short({ count: err.available, name: line.name })
					);
				}
				throw err;
			}
		}

		const [row] = await tx
			.select({ id: orders.id, token: orders.publicToken, total: orders.total })
			.from(orders)
			.where(eq(orders.id, orderId));
		return row;
	});

	// Stock changed: the shop's "sold out" badges come from the cached list.
	invalidate('catalog');
	return created;
}

/** One line per product, quantities summed and capped, in ascending product order. */
function mergeLines(lines: CartLine[]): CartLine[] {
	const qty = new Map<number, number>();
	for (const line of lines) qty.set(line.productId, (qty.get(line.productId) ?? 0) + line.qty);
	return [...qty.entries()]
		.map(([productId, total]) => ({ productId, qty: Math.min(total, MAX_LINE_QTY) }))
		.filter((line) => line.qty > 0)
		.sort((a, b) => a.productId - b.productId);
}

/** Gives an order's stock back: one `sale_cancel` per line. */
async function releaseStock(tx: Writer, orderId: number) {
	const items = await tx
		.select({ productId: orderItem.productId, qty: orderItem.qty })
		.from(orderItem)
		.where(eq(orderItem.orderId, orderId))
		.orderBy(asc(orderItem.productId));
	for (const item of items) {
		await move(tx, {
			productId: item.productId,
			delta: item.qty,
			reason: 'sale_cancel',
			refType: 'order',
			refId: orderId
		});
	}
}

/** Takes an expired order's stock again, all or nothing. Throws `StockShortError` if short. */
async function reserveStockAgain(tx: Writer, orderId: number) {
	const items = await tx
		.select({ productId: orderItem.productId, qty: orderItem.qty })
		.from(orderItem)
		.where(eq(orderItem.orderId, orderId))
		.orderBy(asc(orderItem.productId));
	for (const item of items) {
		await move(tx, {
			productId: item.productId,
			delta: -item.qty,
			reason: 'sale',
			refType: 'order',
			refId: orderId,
			note: 'Re-reserved for a late payment'
		});
	}
}

export const orderPayable: Payable = {
	kind: 'order',

	statusPath: (token) => `/o/${token}`,

	async lockForPayment(tx, id): Promise<PayableState | null> {
		const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
		if (!row) return null;

		const canPay = (PAYABLE_STATUSES as readonly string[]).includes(row.status);
		return {
			id: row.id,
			token: row.publicToken,
			ref: row.ref,
			amountDue: row.total,
			canPay,
			reason: canPay
				? undefined
				: PAID_STATUSES.includes(row.status)
					? m.refused_already_paid()
					: m.refused_expired(),
			contact: { name: row.contactName, phone: row.contactPhone, email: row.contactEmail },
			description: `Order ${row.ref ?? row.id}`
		};
	},

	/**
	 * Late payments (§7): money Chapa has verified is never ignored. An order that expired in the
	 * meantime takes its stock again if it can; if not, it becomes `paid_unfulfillable` for staff
	 * to rebook or refund. The re-reservation runs in a savepoint, so a shortfall on the third
	 * item leaves no movements from the first two.
	 */
	async onPaid(tx, id, paid: PaymentRow) {
		const [row] = await tx
			.select({ status: orders.status })
			.from(orders)
			.where(eq(orders.id, id))
			.for('update');
		if (!row) throw new Error(`onPaid: order ${id} does not exist`);

		if (PAID_STATUSES.includes(row.status)) {
			// A second payment for a paid order (a Chapa retry and a transfer both went through).
			// Recorded on the payment row already; staff refund the extra.
			console.warn(`Order ${id} received another payment (${paid.txRef}) while ${row.status}.`);
			return;
		}

		let status: 'paid' | 'paid_unfulfillable' = 'paid';
		if (row.status !== 'pending_payment') {
			try {
				await tx.transaction((savepoint) => reserveStockAgain(savepoint, id));
			} catch (err) {
				if (!(err instanceof StockShortError)) throw err;
				status = 'paid_unfulfillable';
			}
		}

		await tx
			.update(orders)
			.set({ status, paidAt: new Date(), holdExpiresAt: null })
			.where(eq(orders.id, id));
	},

	async holdForReview(tx, id) {
		await tx.update(orders).set({ holdExpiresAt: null }).where(eq(orders.id, id));
	},

	async onPaymentRejected(tx, id) {
		const [row] = await tx
			.select({ status: orders.status })
			.from(orders)
			.where(eq(orders.id, id))
			.for('update');
		if (row?.status !== 'pending_payment') return;
		// Another receipt still waiting keeps the order held for review.
		const [waiting] = await tx
			.select({ id: payment.id })
			.from(payment)
			.where(
				and(
					eq(payment.orderId, id),
					eq(payment.provider, 'bank_transfer'),
					eq(payment.status, 'initiated')
				)
			)
			.limit(1);
		if (waiting) return;
		const { holdMinutes } = await getSettings();
		await tx
			.update(orders)
			.set({ holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000) })
			.where(eq(orders.id, id));
	}
};

/** The moves a customer is told about; `paid` is announced by the payment, not by staff. */
const NOTIFIED: Partial<Record<OrderStatus, OrderEvent>> = {
	preparing: 'preparing',
	ready: 'ready',
	completed: 'completed',
	cancelled: 'cancelled'
};

/**
 * Moves an order along by hand (§6: one service function per state change). The allowed moves are
 * `ORDER_TRANSITIONS`, shared with the buttons. Cancelling puts back whatever stock the order still
 * holds; moving a `paid_unfulfillable` order back to `preparing` takes its stock again, all or
 * nothing, and is refused if it is still short.
 */
export async function setOrderStatus(
	orderId: number,
	to: OrderStatus,
	actor: Actor,
	note?: string
) {
	await transaction(async (tx) => {
		const [row] = await tx
			.select({ status: orders.status, notes: orders.notes })
			.from(orders)
			.where(eq(orders.id, orderId))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That order does not exist.');
		if (!ORDER_TRANSITIONS[row.status].includes(to)) {
			throw new WriteRefused(
				null,
				`An order that is ${row.status.replace('_', ' ')} cannot become ${to.replace('_', ' ')}.`
			);
		}

		if (to === 'cancelled' && HOLDS_STOCK.includes(row.status)) await releaseStock(tx, orderId);
		if (row.status === 'paid_unfulfillable' && to === 'preparing') {
			try {
				await tx.transaction((savepoint) => reserveStockAgain(savepoint, orderId));
			} catch (err) {
				if (err instanceof StockShortError) {
					throw new WriteRefused(
						null,
						'Still not enough stock for this order. Adjust stock first, or cancel and refund.'
					);
				}
				throw err;
			}
		}

		await tx
			.update(orders)
			.set({ status: to, holdExpiresAt: to === 'cancelled' ? null : undefined })
			.where(eq(orders.id, orderId));
		await recordAudit(tx, actor, {
			table: 'orders',
			recordId: orderId,
			action: 'update',
			before: { status: row.status },
			after: { status: to },
			detail: note ? { note } : undefined
		});
	});
	invalidate('catalog');
	if (NOTIFIED[to]) void notifyOrder(orderId, NOTIFIED[to]);
}

/**
 * Expires unpaid orders whose hold has run out and gives their stock back (job `expire-holds`).
 * Bounded to `limit` per run; each order is its own transaction, re-checked under lock, so an
 * order paid a moment ago is left alone.
 */
export async function expireHolds(limit = 50): Promise<number> {
	const due = await db
		.select({ id: orders.id })
		.from(orders)
		.where(and(eq(orders.status, 'pending_payment'), lt(orders.holdExpiresAt, new Date())))
		.orderBy(asc(orders.holdExpiresAt))
		.limit(limit);

	let expired = 0;
	for (const { id } of due) {
		const done = await transaction(async (tx) => {
			const [row] = await tx
				.select({ status: orders.status, holdExpiresAt: orders.holdExpiresAt })
				.from(orders)
				.where(eq(orders.id, id))
				.for('update');
			if (
				row?.status !== 'pending_payment' ||
				!row.holdExpiresAt ||
				row.holdExpiresAt > new Date()
			) {
				return false;
			}
			await tx.update(orders).set({ status: 'expired' }).where(eq(orders.id, id));
			await releaseStock(tx, id);
			return true;
		});
		if (done) expired++;
	}

	if (expired) invalidate('catalog');
	return expired;
}

/** Everything `/o/[token]` shows. Null for an unknown token. */
export async function orderByToken(token: string) {
	const [row] = await db.select().from(orders).where(eq(orders.publicToken, token));
	if (!row) return null;

	const [items, payments] = await Promise.all([
		db
			.select({
				id: orderItem.id,
				name: orderItem.nameSnapshot,
				qty: orderItem.qty,
				unitPrice: orderItem.unitPrice,
				lineTotal: orderItem.lineTotal
			})
			.from(orderItem)
			.where(eq(orderItem.orderId, row.id))
			.orderBy(asc(orderItem.id)),
		db
			.select({
				id: payment.id,
				txRef: payment.txRef,
				provider: payment.provider,
				status: payment.status,
				amount: payment.amount,
				createdAt: payment.createdAt,
				bankName: bankAccount.bankName
			})
			.from(payment)
			.leftJoin(bankAccount, eq(bankAccount.id, payment.bankAccountId))
			.where(eq(payment.orderId, row.id))
			.orderBy(desc(payment.id))
	]);

	return { order: row, items, payments };
}
