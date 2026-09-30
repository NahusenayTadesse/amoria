import { eq, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { transaction } from '$lib/server/db/retry';
import { invalidate } from '$lib/server/cache';
import { STOCK_REASON_META, type StockReason } from '$lib/stock';
import type { Actor } from './payments/payable';
import type { Writer } from '@nahu/admin-kit/server/db';
import { product, stockMovement } from '$lib/server/db/schema';
import type { STOCK_REASONS } from '$lib/constants';

/** A movement would take a product below zero. `productId` says which. */
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
};

/**
 * **The only writer of `product.stockQty`** (§6). Locks the product row, refuses to go below
 * zero, writes the ledger row and the new quantity — all in the caller's transaction, so a
 * movement and whatever caused it commit or roll back together.
 *
 * Callers moving several products should move them in ascending `productId` order, so two
 * checkouts sharing products always lock in the same order and cannot deadlock.
 */
export async function move(tx: Writer, movement: Movement): Promise<number> {
	const [row] = await tx
		.select({ stockQty: product.stockQty })
		.from(product)
		.where(eq(product.id, movement.productId))
		.for('update');

	if (!row) throw new Error(`stock.move: product ${movement.productId} does not exist`);

	const next = row.stockQty + movement.delta;
	if (next < 0) throw new StockShortError(movement.productId, Math.max(0, row.stockQty));

	await tx.insert(stockMovement).values({
		productId: movement.productId,
		delta: movement.delta,
		reason: movement.reason,
		refType: movement.refType,
		refId: movement.refId,
		note: movement.note,
		createdBy: movement.createdBy ?? null
	});
	await tx
		.update(product)
		.set({ stockQty: sql`${product.stockQty} + ${movement.delta}` })
		.where(eq(product.id, movement.productId));

	return next;
}

export type Adjustment =
	/** Add or remove a quantity for a reason: a delivery, damage, a loss. */
	| { mode: 'move'; reason: StockReason; qty: number; note: string | null }
	/** A stock count: set the shelf to what was counted; the difference is an `adjustment`. */
	| { mode: 'count'; counted: number; note: string | null };

/**
 * A stock change staff record by hand, for any product (§5.2 `stock.adjust`). The direction comes
 * from the reason (`$lib/stock`), never from the sign the form sent, so "Damaged 3" can only
 * remove three. Refuses reasons only the system writes, and anything that would go below zero.
 */
export async function adjustStock(productId: number, input: Adjustment, actor: Actor) {
	await transaction(async (tx) => {
		const [row] = await tx
			.select({ stockQty: product.stockQty })
			.from(product)
			.where(eq(product.id, productId))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That product does not exist.');

		let delta: number;
		let reason: StockReason;
		if (input.mode === 'count') {
			delta = input.counted - row.stockQty;
			reason = 'adjustment';
			if (delta === 0) throw new WriteRefused('counted', 'That is already the quantity on record.');
		} else {
			const meta = STOCK_REASON_META[input.reason];
			if (!meta?.manual)
				throw new WriteRefused('reason', 'That reason is recorded by the system, not by hand.');
			reason = input.reason;
			delta =
				meta.direction === 'out'
					? -Math.abs(input.qty)
					: meta.direction === 'in'
						? Math.abs(input.qty)
						: input.qty;
			if (delta === 0) throw new WriteRefused('qty', 'Enter a quantity other than zero.');
		}

		try {
			await move(tx, {
				productId,
				delta,
				reason,
				refType: input.mode === 'count' ? 'count' : undefined,
				note: input.note ?? undefined,
				createdBy: actor.locals.user?.id ?? null
			});
		} catch (err) {
			if (err instanceof StockShortError) {
				throw new WriteRefused(
					input.mode === 'count' ? 'counted' : 'qty',
					`Only ${err.available} on record; that would go below zero.`
				);
			}
			throw err;
		}

		await recordAudit(tx, actor, {
			table: 'product',
			recordId: productId,
			action: 'update',
			before: { stockQty: row.stockQty },
			after: { stockQty: row.stockQty + delta },
			detail: { reason }
		});
	});
	invalidate('catalog');
}
