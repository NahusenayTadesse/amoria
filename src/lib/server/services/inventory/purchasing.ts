/**
 * Buying: purchase orders to suppliers, receiving against them, and what to reorder.
 *
 * An order is drafted freely, then "marked ordered" (which numbers it and fixes it). Goods arrive
 * as ordinary goods receipts (`post.ts`) that point back at it; the order's status follows what
 * those receipts delivered (`refreshOrderStatus`, called when a receipt posts). Orders are never
 * deleted (§5.0): a dropped one is `cancelled`.
 */
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import type { Writer } from '@nahu/admin-kit/server/db';
import { addLocalDays, localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import {
	product,
	purchaseOrder,
	purchaseOrderLine,
	stockBalance,
	stockDocument,
	stockDocumentLine,
	stockMovement,
	supplier
} from '$lib/server/db/schema';
import type { Actor } from '../payments/payable';
import { getSettings } from '../settings';
import { places, defaultPlace } from './ledger';
import { nextNumber } from './numbering';
import { saveDocument } from './documents';

/** What each line of an order has received so far: quantity on posted receipts, by line. */
export async function receivedByLine(tx: Writer, purchaseOrderId: number) {
	const rows = await tx
		.select({
			lineId: stockDocumentLine.purchaseOrderLineId,
			qty: sql<number>`COALESCE(SUM(${stockDocumentLine.quantity}), 0)`
		})
		.from(stockDocumentLine)
		.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
		.where(
			and(
				eq(stockDocument.purchaseOrderId, purchaseOrderId),
				eq(stockDocument.type, 'receipt'),
				eq(stockDocument.status, 'posted')
			)
		)
		.groupBy(stockDocumentLine.purchaseOrderLineId);
	return new Map(rows.map((r) => [r.lineId, Number(r.qty)]));
}

/**
 * Brings an order's status in step with what posted receipts delivered (ordered → partly received
 * → received). Called in the transaction that posts a receipt. Drafts, closed and cancelled orders
 * are left alone: closing an order is a person's decision.
 */
export async function refreshOrderStatus(tx: Writer, purchaseOrderId: number) {
	const [order] = await tx
		.select({ status: purchaseOrder.status })
		.from(purchaseOrder)
		.where(eq(purchaseOrder.id, purchaseOrderId))
		.for('update');
	if (!order || !['ordered', 'partially_received', 'received'].includes(order.status)) return;

	const lines = await tx
		.select({ id: purchaseOrderLine.id, quantity: purchaseOrderLine.quantity })
		.from(purchaseOrderLine)
		.where(eq(purchaseOrderLine.purchaseOrderId, purchaseOrderId));
	const received = await receivedByLine(tx, purchaseOrderId);
	const got = lines.map((l) => received.get(l.id) ?? 0);
	const status =
		lines.length && lines.every((l, i) => got[i] >= l.quantity)
			? 'received'
			: got.some((n) => n > 0)
				? 'partially_received'
				: 'ordered';
	if (status !== order.status) {
		await tx.update(purchaseOrder).set({ status }).where(eq(purchaseOrder.id, purchaseOrderId));
	}
}

export type OrderHeader = {
	supplierId: number;
	orderDate: string;
	expectedDate?: string | null;
	locationId: number;
	reference?: string | null;
	note?: string | null;
};
export type OrderLineInput = {
	productId: number;
	quantity: number;
	unitCost?: number | null;
	note?: string | null;
};

/** Creates a draft order, or replaces the header and lines of an existing draft. */
export async function saveOrder(
	input: { id?: number; header: OrderHeader; lines: OrderLineInput[] },
	actor: Actor
): Promise<number> {
	const { header, lines } = input;
	if (!lines.length) throw new WriteRefused('lines', 'Add at least one line.');
	if (lines.some((l) => !(l.quantity > 0))) {
		throw new WriteRefused('lines', 'Every line needs a quantity of at least 1.');
	}
	return transaction(async (tx) => {
		const [sup] = await tx
			.select({ id: supplier.id })
			.from(supplier)
			.where(and(eq(supplier.id, header.supplierId), sql`${supplier.deletedAt} IS NULL`));
		if (!sup) throw new WriteRefused('supplierId', 'That supplier no longer exists.');

		let id = input.id;
		if (id) {
			const [existing] = await tx
				.select({ status: purchaseOrder.status })
				.from(purchaseOrder)
				.where(eq(purchaseOrder.id, id))
				.for('update');
			if (!existing) throw new WriteRefused(null, 'That order does not exist.');
			if (existing.status !== 'draft') {
				throw new WriteRefused(null, 'Only a draft order can be edited. Ordered ones are fixed.');
			}
			await tx.update(purchaseOrder).set(header).where(eq(purchaseOrder.id, id));
			await tx.delete(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, id));
		} else {
			id = await insertReturningId(tx, purchaseOrder, {
				...header,
				createdBy: actor.locals.user?.id ?? null
			});
		}
		await tx.insert(purchaseOrderLine).values(
			lines.map((l) => ({
				purchaseOrderId: id!,
				productId: l.productId,
				quantity: l.quantity,
				unitCost: l.unitCost ?? null,
				note: l.note?.trim() || null
			}))
		);
		return id!;
	});
}

/**
 * Creates a draft order with a header and no lines yet, or changes a draft's header. The dashboard
 * makes the order first and adds its lines one at a time (`childCrud`); `saveOrder` is for callers
 * that already have every line.
 */
export async function saveOrderHeader(
	input: { id?: number; header: OrderHeader },
	actor: Actor
): Promise<number> {
	return transaction(async (tx) => {
		const [sup] = await tx
			.select({ id: supplier.id })
			.from(supplier)
			.where(and(eq(supplier.id, input.header.supplierId), sql`${supplier.deletedAt} IS NULL`));
		if (!sup) throw new WriteRefused('supplierId', 'That supplier no longer exists.');
		if (!input.id) {
			return insertReturningId(tx, purchaseOrder, {
				...input.header,
				createdBy: actor.locals.user?.id ?? null
			});
		}
		const [existing] = await tx
			.select({ status: purchaseOrder.status })
			.from(purchaseOrder)
			.where(eq(purchaseOrder.id, input.id))
			.for('update');
		if (!existing) throw new WriteRefused(null, 'That order does not exist.');
		if (existing.status !== 'draft') {
			throw new WriteRefused(null, 'Only a draft order can be edited. Ordered ones are fixed.');
		}
		await tx.update(purchaseOrder).set(input.header).where(eq(purchaseOrder.id, input.id));
		return input.id;
	});
}

/** Numbers a draft order and fixes it: this is what the supplier is sent. */
export async function markOrdered(id: number, actor: Actor): Promise<string> {
	return transaction(async (tx) => {
		const [order] = await tx
			.select()
			.from(purchaseOrder)
			.where(eq(purchaseOrder.id, id))
			.for('update');
		if (!order) throw new WriteRefused(null, 'That order does not exist.');
		if (order.status !== 'draft') throw new WriteRefused(null, 'That order is already placed.');
		// Lines struck out while drafting are gone for good once the order is placed.
		await tx
			.delete(purchaseOrderLine)
			.where(
				and(eq(purchaseOrderLine.purchaseOrderId, id), isNotNull(purchaseOrderLine.deletedAt))
			);
		const [{ n }] = await tx
			.select({ n: sql<number>`COUNT(*)` })
			.from(purchaseOrderLine)
			.where(eq(purchaseOrderLine.purchaseOrderId, id));
		if (!Number(n)) throw new WriteRefused(null, 'Add at least one line first.');

		const number = await nextNumber(tx, 'purchase_order', order.orderDate);
		await tx
			.update(purchaseOrder)
			.set({
				number,
				status: 'ordered',
				orderedAt: new Date(),
				orderedBy: actor.locals.user?.id ?? null
			})
			.where(eq(purchaseOrder.id, id));
		await recordAudit(tx, actor, {
			table: 'purchase_order',
			recordId: id,
			action: 'update',
			before: { status: 'draft' },
			after: { status: 'ordered', number }
		});
		return number;
	});
}

/** Drops an order that has not been received against. Received ones are closed instead. */
export async function cancelOrder(id: number, actor: Actor) {
	await transaction(async (tx) => {
		const [order] = await tx
			.select({ status: purchaseOrder.status })
			.from(purchaseOrder)
			.where(eq(purchaseOrder.id, id))
			.for('update');
		if (!order) throw new WriteRefused(null, 'That order does not exist.');
		if (order.status !== 'draft' && order.status !== 'ordered') {
			throw new WriteRefused(
				null,
				order.status === 'cancelled'
					? 'That order is already cancelled.'
					: 'Goods have been received on that order. Close it instead.'
			);
		}
		await tx.update(purchaseOrder).set({ status: 'cancelled' }).where(eq(purchaseOrder.id, id));
		await recordAudit(tx, actor, {
			table: 'purchase_order',
			recordId: id,
			action: 'update',
			before: { status: order.status },
			after: { status: 'cancelled' }
		});
	});
}

/** Stops what is still due on a part-received order from counting as "on order". */
export async function closeOrder(id: number, actor: Actor) {
	await transaction(async (tx) => {
		const [order] = await tx
			.select({ status: purchaseOrder.status })
			.from(purchaseOrder)
			.where(eq(purchaseOrder.id, id))
			.for('update');
		if (!order) throw new WriteRefused(null, 'That order does not exist.');
		if (!['ordered', 'partially_received', 'received'].includes(order.status)) {
			throw new WriteRefused(null, 'Only an order that has been placed can be closed.');
		}
		await tx.update(purchaseOrder).set({ status: 'closed' }).where(eq(purchaseOrder.id, id));
		await recordAudit(tx, actor, {
			table: 'purchase_order',
			recordId: id,
			action: 'update',
			before: { status: order.status },
			after: { status: 'closed' }
		});
	});
}

/**
 * Drafts the goods receipt for everything still due on an order, at the agreed prices. The
 * storekeeper corrects it to what actually arrived and posts it. Returns the draft's id.
 */
export async function draftReceiptFromOrder(id: number, actor: Actor): Promise<number> {
	const [order] = await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, id));
	if (!order) throw new WriteRefused(null, 'That order does not exist.');
	if (!['ordered', 'partially_received'].includes(order.status)) {
		throw new WriteRefused(null, 'Only a placed order that is not yet complete can be received.');
	}
	const lines = await db
		.select()
		.from(purchaseOrderLine)
		.where(eq(purchaseOrderLine.purchaseOrderId, id))
		.orderBy(asc(purchaseOrderLine.id));
	const received = await receivedByLine(db, id);
	const due = lines
		.map((l) => ({ line: l, left: l.quantity - (received.get(l.id) ?? 0) }))
		.filter((x) => x.left > 0);
	if (!due.length) throw new WriteRefused(null, 'Everything on that order has been received.');

	return saveDocument(
		{
			header: {
				type: 'receipt',
				docDate: localToday(),
				toLocationId: order.locationId,
				supplierId: order.supplierId,
				purchaseOrderId: id,
				reference: order.number
			},
			lines: due.map(({ line, left }) => ({
				productId: line.productId,
				quantity: left,
				unitCost: line.unitCost,
				purchaseOrderLineId: line.id
			}))
		},
		actor
	);
}

/** Units on order and not yet delivered, per product (optionally for one delivery location). */
export async function onOrderByProduct(reader: Writer = db, locationId: number | null = null) {
	const rows = await reader
		.select({
			productId: purchaseOrderLine.productId,
			ordered: sql<number>`SUM(${purchaseOrderLine.quantity})`,
			lineIds: sql<string>`GROUP_CONCAT(${purchaseOrderLine.id})`
		})
		.from(purchaseOrderLine)
		.innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
		.where(
			and(
				inArray(purchaseOrder.status, ['ordered', 'partially_received']),
				locationId ? eq(purchaseOrder.locationId, locationId) : undefined
			)
		)
		.groupBy(purchaseOrderLine.productId);
	if (!rows.length) return new Map<number, number>();

	const got = await reader
		.select({
			productId: stockDocumentLine.productId,
			qty: sql<number>`SUM(${stockDocumentLine.quantity})`
		})
		.from(stockDocumentLine)
		.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
		.innerJoin(purchaseOrder, eq(purchaseOrder.id, stockDocument.purchaseOrderId))
		.where(
			and(
				eq(stockDocument.type, 'receipt'),
				eq(stockDocument.status, 'posted'),
				inArray(purchaseOrder.status, ['ordered', 'partially_received']),
				locationId ? eq(purchaseOrder.locationId, locationId) : undefined
			)
		)
		.groupBy(stockDocumentLine.productId);
	const received = new Map(got.map((g) => [g.productId, Number(g.qty)]));
	return new Map(
		rows.map((r) => [
			r.productId,
			Math.max(0, Number(r.ordered) - (received.get(r.productId) ?? 0))
		])
	);
}

const DEFAULT_LEAD_DAYS = 7;
/** How many days of use an order should cover beyond the lead time. */
const COVER_DAYS = 30;

/**
 * What to buy: products at or under their reorder level, or that will run out before an order
 * placed today could arrive at the recent rate of use. Planning "for a location" uses that
 * location's own min/max (`reorder_rule`); otherwise a product plans on its own low-stock
 * threshold (else the shop default) across everywhere it can sell.
 *
 * Usage is what left the business over the last `days`: sales, till sales, issues, damage, loss and
 * expiry, net of cancelled sales and customer returns. Suggests filling up to the location's max
 * (or twice the level), and never less than the lead time plus 30 days of use needs, less what is
 * on hand and already on order.
 */
export async function reorderSuggestions(
	options: { locationId?: number | null; today?: string; days?: number } = {}
) {
	const locationId = options.locationId ?? null;
	const today = options.today ?? localToday();
	const days = options.days ?? 90;
	const since = addLocalDays(today, -days);
	const { lowStockDefault } = await getSettings();

	const [products, balances, usage, rules, onOrder] = await Promise.all([
		db
			.select({
				id: product.id,
				name: product.name,
				sku: product.sku,
				unit: product.unit,
				kind: product.kind,
				threshold: product.lowStockThreshold,
				avgCost: product.avgCost,
				supplierId: product.mainSupplierId,
				supplier: supplier.name,
				leadTimeDays: supplier.leadTimeDays
			})
			.from(product)
			.leftJoin(supplier, eq(supplier.id, product.mainSupplierId))
			.where(and(sql`${product.deletedAt} IS NULL`, eq(product.isActive, true)))
			.orderBy(asc(supplier.name), asc(product.name)),
		db
			.select({
				productId: stockBalance.productId,
				quantity: sql<number>`SUM(${stockBalance.quantity})`
			})
			.from(stockBalance)
			.where(locationId ? eq(stockBalance.locationId, locationId) : undefined)
			.groupBy(stockBalance.productId),
		db
			.select({
				productId: stockMovement.productId,
				used: sql<number>`COALESCE(SUM(CASE WHEN ${stockMovement.docDate} >= ${since}
					AND ${stockMovement.reason} IN ('sale','sale_cancel','pos_sale','customer_return','issue','damage','loss','expiry')
					THEN -${stockMovement.delta} ELSE 0 END), 0)`,
				first: sql<string>`MIN(${stockMovement.docDate})`
			})
			.from(stockMovement)
			.where(locationId ? eq(stockMovement.locationId, locationId) : undefined)
			.groupBy(stockMovement.productId),
		locationId
			? db.query.reorderRule.findMany({ where: (r, { eq }) => eq(r.locationId, locationId) })
			: Promise.resolve([]),
		onOrderByProduct(db, locationId)
	]);

	const out = [];
	for (const p of products) {
		const rule = rules.find((r) => r.productId === p.id);
		const min = locationId ? (rule?.minQuantity ?? null) : (p.threshold ?? lowStockDefault);
		const max = locationId ? (rule?.maxQuantity ?? null) : null;
		const onHand = Number(balances.find((b) => b.productId === p.id)?.quantity ?? 0);
		const ordered = onOrder.get(p.id) ?? 0;

		// Usage per day over the window, or since it first moved if that is sooner (never fewer than
		// two weeks, so one early sale does not look like a trend).
		const u = usage.find((x) => x.productId === p.id);
		const known = u?.first ? daysBetween(u.first, today) : 0;
		const window = Math.min(days, Math.max(14, known));
		const perDay = u ? Math.max(0, Number(u.used)) / window : 0;

		const lead = p.leadTimeDays ?? DEFAULT_LEAD_DAYS;
		const daysLeft = perDay > 0 ? Math.max(0, Math.floor(onHand / perDay)) : null;
		const belowMin = min !== null && onHand <= min;
		const runsOut = perDay > 0 && onHand + ordered - perDay * lead < 0;
		if (!belowMin && !runsOut) continue;

		const byLevel = max ?? (min !== null ? 2 * min : 0);
		const byUse = perDay > 0 ? perDay * (lead + COVER_DAYS) : 0;
		const target = max !== null ? max : Math.max(byLevel, byUse);
		out.push({
			...p,
			reorderLevel: min,
			max,
			onHand,
			onOrder: ordered,
			usagePerDay: Math.round(perDay * 1000) / 1000,
			daysLeft,
			leadTimeDays: lead,
			leadTimeAssumed: p.leadTimeDays === null,
			belowMin,
			runsOut,
			suggested: Math.max(0, Math.ceil(target - onHand - ordered))
		});
	}
	return out;
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Draft orders from the reorder screen: one per main supplier, at the product's average cost as a
 * starting price, delivered to the shop floor. Products with no main supplier are refused: say who
 * to buy from first. Returns the new orders' ids.
 */
export async function ordersFromReorder(
	picks: { productId: number; quantity: number }[],
	actor: Actor
): Promise<number[]> {
	const wanted = picks.filter((p) => p.quantity > 0);
	if (!wanted.length) throw new WriteRefused(null, 'Choose at least one product.');
	const rows = await db
		.select({
			id: product.id,
			name: product.name,
			supplierId: product.mainSupplierId,
			avgCost: product.avgCost
		})
		.from(product)
		.where(
			inArray(
				product.id,
				wanted.map((w) => w.productId)
			)
		);
	const missing = rows.filter((r) => !r.supplierId).map((r) => r.name);
	if (missing.length) {
		throw new WriteRefused(
			null,
			`Set a main supplier first for: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}.`
		);
	}
	const shop = defaultPlace(await db.transaction((tx) => places(tx))).id;
	const bySupplier = new Map<number, OrderLineInput[]>();
	for (const w of wanted) {
		const r = rows.find((x) => x.id === w.productId);
		if (!r) continue;
		const list = bySupplier.get(r.supplierId!) ?? [];
		list.push({
			productId: r.id,
			quantity: w.quantity,
			unitCost: r.avgCost > 0 ? r.avgCost : null
		});
		bySupplier.set(r.supplierId!, list);
	}
	const ids: number[] = [];
	for (const [supplierId, lines] of bySupplier) {
		ids.push(
			await saveOrder(
				{ header: { supplierId, orderDate: localToday(), locationId: shop }, lines },
				actor
			)
		);
	}
	return ids;
}
