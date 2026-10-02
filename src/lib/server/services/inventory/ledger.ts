/**
 * The ledger: **the only writer of `stock_balance`, `stock_movement` and `product.stockQty`** (§6).
 *
 * `move()` is one change to one product's stock. It locks the product row, works out which
 * locations and lots the quantity comes from (or goes to), refuses to go below zero, and writes the
 * ledger rows, the cached balances and the product's sellable total together, in the caller's
 * transaction, so a movement and whatever caused it commit or roll back as one.
 *
 * Callers moving several products should move them in ascending `productId` order, so two
 * transactions sharing products always lock in the same order and cannot deadlock.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localToday } from '@nahu/admin-kit/time';
import { location, product, stockBalance, stockLot, stockMovement } from '$lib/server/db/schema';
import type { STOCK_REASONS } from '$lib/constants';
import { allocate, movingAverage, round4, type Candidate } from '$lib/stockMath';

/** A movement would take a product below zero. `available` is what could have been taken. */
export class StockShortError extends Error {
	constructor(
		readonly productId: number,
		readonly available: number
	) {
		super(`Only ${available} left of product ${productId}`);
		this.name = 'StockShortError';
	}
}

export type Movement = {
	productId: number;
	/** Signed: positive in, negative out. */
	delta: number;
	reason: (typeof STOCK_REASONS)[number];
	refType?: string;
	refId?: number;
	note?: string;
	createdBy?: string | null;
	/**
	 * In: where it goes (default: the shop floor). Out: the only place it may come from (default:
	 * every location that can sell, the shop floor first).
	 */
	locationId?: number;
	/** In: the lot it belongs to. Out: take only from this lot (empty: any lot, earliest expiry first). */
	lotId?: number | null;
	/** Out: `lotId: null` means stock with no lot, not any lot: what a stock count's lines say. */
	exactLot?: boolean;
	documentId?: number;
	/** In: what one unit cost. Out: ignored; stock leaves at the average cost. */
	unitCost?: number;
	/** In: let `unitCost` move the product's average (a delivery, opening stock), not a return. */
	revalue?: boolean;
	/** Out: may reach expired, quarantined and recalled lots (a write-off, a move to quarantine). */
	allowUnusable?: boolean;
	/** The business day; today when not given. */
	docDate?: string;
};

type Place = {
	id: number;
	kind: 'shop' | 'storage' | 'workshop' | 'quarantine';
	sortOrder: number;
};

/**
 * Every live location, shop floor first. A shop floor is made on first use if nothing that can
 * sell exists (an empty table, or only quarantine), so stock never has nowhere sensible to sit.
 */
export async function places(tx: Writer): Promise<Place[]> {
	const read = () =>
		tx
			.select({ id: location.id, kind: location.kind, sortOrder: location.sortOrder })
			.from(location)
			.where(and(eq(location.status, true), sql`${location.deletedAt} IS NULL`))
			.orderBy(asc(location.sortOrder), asc(location.id));
	let list = await read();
	if (!list.some((p) => p.kind !== 'quarantine')) {
		await tx.insert(location).ignore().values({ name: 'Shop floor', kind: 'shop' });
		list = await read();
	}
	return [...list].sort(
		(a, b) => Number(b.kind === 'shop') - Number(a.kind === 'shop') || a.sortOrder - b.sortOrder
	);
}

/** Where a delivery lands when nobody says: the shop floor, else the first place that can sell. */
export function defaultPlace(list: Place[]): Place {
	return (
		list.find((p) => p.kind === 'shop') ?? list.find((p) => p.kind !== 'quarantine') ?? list[0]
	);
}

/** One place and lot a movement touched, and how much (signed). */
export type Touch = { locationId: number; lotId: number | null; delta: number };

/** `moveDetailed`, when only the product's new sellable total matters. */
export async function move(tx: Writer, m: Movement): Promise<number> {
	return (await moveDetailed(tx, m)).stockQty;
}

/**
 * `move`, also saying which locations and lots the quantity was taken from or put into: a transfer
 * needs it to bring exactly those lots in at the other end.
 */
export async function moveDetailed(
	tx: Writer,
	m: Movement
): Promise<{ stockQty: number; touched: Touch[] }> {
	const [row] = await tx
		.select({ stockQty: product.stockQty, avgCost: product.avgCost })
		.from(product)
		.where(eq(product.id, m.productId))
		.for('update');
	if (!row) throw new Error(`stock.move: product ${m.productId} does not exist`);
	if (m.delta === 0) return { stockQty: row.stockQty, touched: [] };

	const list = await places(tx);
	const kindOf = new Map(list.map((p) => [p.id, p.kind]));
	const today = localToday();

	let rows: Touch[];
	if (m.delta > 0) {
		rows = await placeIn(tx, m, list);
	} else {
		const need = -m.delta;
		const scope = m.locationId
			? list.filter((p) => p.id === m.locationId)
			: list.filter((p) => p.kind !== 'quarantine');
		const order = new Map(scope.map((p, i) => [p.id, i]));
		const found = scope.length
			? await tx
					.select({
						locationId: stockBalance.locationId,
						lotId: stockBalance.lotId,
						quantity: stockBalance.quantity,
						expiryDate: stockLot.expiryDate,
						status: stockLot.status
					})
					.from(stockBalance)
					.leftJoin(stockLot, eq(stockLot.id, stockBalance.lotId))
					.where(
						and(
							eq(stockBalance.productId, m.productId),
							sql`${stockBalance.locationId} IN (${sql.join(
								scope.map((p) => sql`${p.id}`),
								sql`, `
							)})`,
							sql`${stockBalance.quantity} > 0`
						)
					)
					.for('update')
			: [];
		const candidates: Candidate[] = found
			.map((f) => ({
				locationId: f.locationId,
				lotId: f.lotId,
				quantity: f.quantity,
				expiryDate: f.expiryDate,
				status: f.status
			}))
			.sort((a, b) => order.get(a.locationId)! - order.get(b.locationId)!);
		const { takes, short } = allocate(candidates, need, {
			today,
			allowUnusable: m.allowUnusable,
			lotId: m.lotId,
			exactLot: m.exactLot
		});
		if (short > 0) throw new StockShortError(m.productId, need - short);
		rows = takes.map((t) => ({ locationId: t.locationId, lotId: t.lotId, delta: -t.quantity }));
	}

	// Only a delivery or opening count (not a return) moves the average, and only on the way in.
	let cost = row.avgCost;
	if (m.delta > 0 && m.unitCost != null) {
		cost = round4(m.unitCost);
		if (m.revalue) {
			const [{ onHand }] = await tx
				.select({ onHand: sql<number>`COALESCE(SUM(${stockBalance.quantity}), 0)` })
				.from(stockBalance)
				.where(eq(stockBalance.productId, m.productId));
			const next = movingAverage(Number(onHand), row.avgCost, m.delta, cost);
			if (next !== row.avgCost) {
				await tx.update(product).set({ avgCost: next }).where(eq(product.id, m.productId));
			}
		}
	}

	let sellable = 0;
	for (const r of rows) {
		await tx.insert(stockMovement).values({
			productId: m.productId,
			locationId: r.locationId,
			lotId: r.lotId,
			delta: r.delta,
			reason: m.reason,
			unitCost: cost,
			documentId: m.documentId,
			refType: m.refType,
			refId: m.refId,
			docDate: m.docDate ?? today,
			note: m.note,
			createdBy: m.createdBy ?? null
		});
		await tx
			.insert(stockBalance)
			.values({
				locationId: r.locationId,
				productId: m.productId,
				lotId: r.lotId,
				lotKey: r.lotId ?? 0,
				quantity: r.delta
			})
			.onDuplicateKeyUpdate({ set: { quantity: sql`${stockBalance.quantity} + ${r.delta}` } });
		if (kindOf.get(r.locationId) !== 'quarantine') sellable += r.delta;
	}

	if (sellable !== 0) {
		await tx
			.update(product)
			.set({ stockQty: sql`${product.stockQty} + ${sellable}` })
			.where(eq(product.id, m.productId));
	}
	return { stockQty: row.stockQty + sellable, touched: rows };
}

/**
 * Where incoming stock goes. A cancelled sale goes back exactly where the sale took it from (same
 * location, same lot), so lots and expiry dates survive a cancellation; everything else goes where
 * it is told, else onto the shop floor.
 */
async function placeIn(tx: Writer, m: Movement, list: Place[]): Promise<Touch[]> {
	if (m.reason === 'sale_cancel' && m.refType && m.refId != null && !m.locationId) {
		const taken = await tx
			.select({
				locationId: stockMovement.locationId,
				lotId: stockMovement.lotId,
				net: sql<number>`SUM(${stockMovement.delta})`
			})
			.from(stockMovement)
			.where(
				and(
					eq(stockMovement.productId, m.productId),
					eq(stockMovement.refType, m.refType),
					eq(stockMovement.refId, m.refId),
					sql`${stockMovement.reason} IN ('sale', 'sale_cancel')`
				)
			)
			.groupBy(stockMovement.locationId, stockMovement.lotId)
			.orderBy(asc(stockMovement.locationId));
		const rows: Touch[] = [];
		let left = m.delta;
		for (const t of taken) {
			const outstanding = -Number(t.net);
			if (outstanding <= 0 || left <= 0) continue;
			const back = Math.min(outstanding, left);
			rows.push({ locationId: t.locationId, lotId: t.lotId, delta: back });
			left -= back;
		}
		if (left > 0) rows.push({ locationId: defaultPlace(list).id, lotId: null, delta: left });
		return rows;
	}
	return [
		{ locationId: m.locationId ?? defaultPlace(list).id, lotId: m.lotId ?? null, delta: m.delta }
	];
}
