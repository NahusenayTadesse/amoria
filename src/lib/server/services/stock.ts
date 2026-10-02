import { and, eq, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { transaction } from '$lib/server/db/retry';
import { invalidate } from '$lib/server/cache';
import { STOCK_REASON_META, type StockReason } from '$lib/stock';
import type { Actor } from './payments/payable';
import { product, stockBalance } from '$lib/server/db/schema';
import { move, places, defaultPlace, StockShortError } from './inventory/ledger';

// The ledger lives in `inventory/ledger`; these names are what the rest of the app imports.
export { move, StockShortError };
export type { Movement } from './inventory/ledger';

export type Adjustment =
	/** Add or remove a quantity for a reason: a delivery, damage, a loss. */
	| { mode: 'move'; reason: StockReason; qty: number; note: string | null; locationId?: number }
	/** A stock count: set one location to what was counted; the difference is an `adjustment`. */
	| { mode: 'count'; counted: number; note: string | null; locationId?: number };

/**
 * A stock change staff record by hand, for any product (§5.2 `stock.adjust`), at one location (the
 * shop floor unless told). The direction comes from the reason (`$lib/stock`), never from the sign
 * the form sent, so "Damaged 3" can only remove three. Refuses reasons only the system writes,
 * and anything that would go below zero.
 *
 * Deliveries of a product that tracks lots go through a goods receipt instead: they need a lot
 * number and an expiry date, which this quick form does not ask for.
 */
export async function adjustStock(productId: number, input: Adjustment, actor: Actor) {
	await transaction(async (tx) => {
		const [row] = await tx
			.select({ stockQty: product.stockQty, trackLots: product.trackLots })
			.from(product)
			.where(eq(product.id, productId))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That product does not exist.');

		const list = await places(tx);
		const locationId = input.locationId ?? defaultPlace(list).id;
		if (!list.some((p) => p.id === locationId)) {
			throw new WriteRefused('locationId', 'That location does not exist.');
		}

		let delta: number;
		let reason: StockReason;
		if (input.mode === 'count') {
			const [{ here }] = await tx
				.select({ here: sql<number>`COALESCE(SUM(${stockBalance.quantity}), 0)` })
				.from(stockBalance)
				.where(and(eq(stockBalance.productId, productId), eq(stockBalance.locationId, locationId)))
				.for('update');
			delta = input.counted - Number(here);
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
			if (row.trackLots && delta > 0 && (reason === 'delivery' || reason === 'opening')) {
				throw new WriteRefused(
					'reason',
					'This product tracks lots. Record the delivery as a goods receipt, with its lot number and expiry date.'
				);
			}
		}

		try {
			await move(tx, {
				productId,
				delta,
				reason,
				locationId,
				// A correction or a count that removes stock may take damaged or expired units too.
				allowUnusable:
					delta < 0 && (reason === 'adjustment' || reason === 'damage' || reason === 'loss'),
				refType: input.mode === 'count' ? 'count' : undefined,
				note: input.note ?? undefined,
				createdBy: actor.locals.user?.id ?? null
			});
		} catch (err) {
			if (err instanceof StockShortError) {
				throw new WriteRefused(
					input.mode === 'count' ? 'counted' : 'qty',
					`Only ${err.available} on record there; that would go below zero.`
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
			detail: { reason, locationId }
		});
	});
	invalidate('catalog');
}
