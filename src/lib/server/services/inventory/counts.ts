/**
 * Stock counts. Opening one snapshots what the system expects at a location; people enter what they
 * find; posting writes every difference as one adjustment (reason: count) through the ordinary
 * posting service, in the same transaction. The count itself never touches stock, so the count and
 * the ledger stay two separate, checkable records.
 *
 * A count can be blind: counters do not see the expected quantity, so they count rather than
 * confirm. Counts are never deleted (§5.0); a dropped one is `cancelled`.
 */
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { invalidate } from '$lib/server/cache';
import {
	category,
	location,
	product,
	stockBalance,
	stockCount,
	stockCountLine,
	stockDocument,
	stockDocumentLine,
	stockLot,
	stockMovement
} from '$lib/server/db/schema';
import { roundBirr } from '$lib/money';
import type { Actor } from '../payments/payable';
import { getSettings } from '../settings';
import { postInTx } from './post';

/** Opens a count and takes the snapshot, in one transaction. Returns its id. */
export async function openCount(
	input: {
		locationId: number;
		categoryId?: number | null;
		blind: boolean;
		countDate: string;
		note?: string | null;
	},
	actor: Actor
): Promise<number> {
	return transaction(async (tx) => {
		const [loc] = await tx
			.select({ id: location.id })
			.from(location)
			.where(and(eq(location.id, input.locationId), sql`${location.deletedAt} IS NULL`));
		if (!loc) throw new WriteRefused('locationId', 'Choose a location from the list.');

		const [open] = await tx
			.select({ id: stockCount.id })
			.from(stockCount)
			.where(and(eq(stockCount.locationId, loc.id), eq(stockCount.status, 'open')));
		if (open) {
			throw new WriteRefused(
				'locationId',
				`Count #${open.id} is still open for that location. Finish or cancel it first.`
			);
		}

		const id = await insertReturningId(tx, stockCount, {
			locationId: loc.id,
			categoryId: input.categoryId ?? null,
			countDate: input.countDate,
			blind: input.blind,
			note: input.note?.trim() || null,
			createdBy: actor.locals.user?.id ?? null
		});

		// The snapshot: every lot of every counted product with stock here.
		const snapshot = await tx
			.select({
				productId: stockBalance.productId,
				lotId: stockBalance.lotId,
				quantity: stockBalance.quantity
			})
			.from(stockBalance)
			.innerJoin(product, eq(product.id, stockBalance.productId))
			.where(
				and(
					eq(stockBalance.locationId, loc.id),
					gt(stockBalance.quantity, 0),
					sql`${product.deletedAt} IS NULL`,
					input.categoryId ? eq(product.categoryId, input.categoryId) : undefined
				)
			);
		if (snapshot.length) {
			await tx.insert(stockCountLine).values(
				snapshot.map((s) => ({
					countId: id,
					productId: s.productId,
					lotId: s.lotId,
					lotKey: s.lotId ?? 0,
					expected: s.quantity
				}))
			);
		}
		return id;
	});
}

/** The count's lines with names and the value of each difference at average cost. */
export async function countLines(countId: number, reader: Writer = db) {
	const rows = await reader
		.select({
			id: stockCountLine.id,
			productId: stockCountLine.productId,
			product: product.name,
			sku: product.sku,
			unit: product.unit,
			category: category.name,
			lotId: stockCountLine.lotId,
			lotNumber: stockLot.lotNumber,
			expiryDate: stockLot.expiryDate,
			expected: stockCountLine.expected,
			counted: stockCountLine.counted,
			added: stockCountLine.addedDuringCount,
			note: stockCountLine.note,
			avgCost: product.avgCost
		})
		.from(stockCountLine)
		.innerJoin(product, eq(product.id, stockCountLine.productId))
		.leftJoin(category, eq(category.id, product.categoryId))
		.leftJoin(stockLot, eq(stockLot.id, stockCountLine.lotId))
		.where(eq(stockCountLine.countId, countId))
		.orderBy(asc(product.name), sql`${stockLot.expiryDate} IS NULL`, asc(stockLot.expiryDate));

	return rows.map((r) => {
		const variance = r.counted === null ? null : r.counted - r.expected;
		return {
			...r,
			variance,
			varianceValue: variance === null ? null : roundBirr(variance * r.avgCost)
		};
	});
}

async function openCountOrRefuse(tx: Writer, countId: number) {
	const [count] = await tx
		.select()
		.from(stockCount)
		.where(eq(stockCount.id, countId))
		.for('update');
	if (!count) throw new WriteRefused(null, 'That count does not exist.');
	if (count.status !== 'open')
		throw new WriteRefused(null, `That count is already ${count.status}.`);
	return count;
}

/** Saves counted quantities. `null` means not counted yet. */
export async function saveCounts(
	countId: number,
	entries: { lineId: number; counted: number | null }[],
	actor: Actor
) {
	await transaction(async (tx) => {
		await openCountOrRefuse(tx, countId);
		for (const e of entries) {
			if (e.counted !== null && (!Number.isInteger(e.counted) || e.counted < 0)) {
				throw new WriteRefused(null, 'A counted quantity is a whole number, zero or more.');
			}
			await tx
				.update(stockCountLine)
				.set({ counted: e.counted, countedBy: actor.locals.user?.id ?? null })
				.where(and(eq(stockCountLine.id, e.lineId), eq(stockCountLine.countId, countId)));
		}
	});
}

/** Something found on the shelf that the snapshot did not expect. */
export async function addFoundLine(
	input: { countId: number; productId: number; lotId?: number | null; counted: number },
	actor: Actor
) {
	await transaction(async (tx) => {
		await openCountOrRefuse(tx, input.countId);
		const [p] = await tx
			.select({ id: product.id, name: product.name, trackLots: product.trackLots })
			.from(product)
			.where(and(eq(product.id, input.productId), sql`${product.deletedAt} IS NULL`));
		if (!p) throw new WriteRefused('productId', 'Choose a product from the list.');
		if (p.trackLots && !input.lotId) {
			throw new WriteRefused('lotId', `${p.name} tracks lots: choose the lot you found.`);
		}
		if (input.lotId) {
			const [lot] = await tx
				.select({ id: stockLot.id })
				.from(stockLot)
				.where(and(eq(stockLot.id, input.lotId), eq(stockLot.productId, p.id)));
			if (!lot) throw new WriteRefused('lotId', 'That lot is not a lot of this product.');
		}
		const lotKey = input.lotId ?? 0;
		const [existing] = await tx
			.select({ id: stockCountLine.id })
			.from(stockCountLine)
			.where(
				and(
					eq(stockCountLine.countId, input.countId),
					eq(stockCountLine.productId, p.id),
					eq(stockCountLine.lotKey, lotKey)
				)
			);
		if (existing) {
			throw new WriteRefused('productId', `${p.name} is already on this count. Enter it there.`);
		}
		await tx.insert(stockCountLine).values({
			countId: input.countId,
			productId: p.id,
			lotId: input.lotId ?? null,
			lotKey,
			expected: 0,
			counted: input.counted,
			addedDuringCount: true,
			countedBy: actor.locals.user?.id ?? null
		});
	});
}

/**
 * How many movements touched the counted products at the location after the count was opened.
 * Posting applies the differences found against the snapshot, so movements in between are worth a
 * warning to whoever posts.
 */
export async function movedSinceOpened(countId: number): Promise<number> {
	const [count] = await db.select().from(stockCount).where(eq(stockCount.id, countId));
	if (!count) return 0;
	const [row] = await db
		.select({ n: sql<number>`COUNT(*)` })
		.from(stockMovement)
		.where(
			and(
				eq(stockMovement.locationId, count.locationId),
				sql`${stockMovement.createdAt} > ${count.createdAt}`,
				inArray(
					stockMovement.productId,
					db
						.select({ id: stockCountLine.productId })
						.from(stockCountLine)
						.where(eq(stockCountLine.countId, countId))
				)
			)
		);
	return Number(row.n);
}

/** Drops an open count. It stays on record as `cancelled`. */
export async function cancelCount(countId: number, actor: Actor) {
	await transaction(async (tx) => {
		await openCountOrRefuse(tx, countId);
		await tx.update(stockCount).set({ status: 'cancelled' }).where(eq(stockCount.id, countId));
		await recordAudit(tx, actor, {
			table: 'stock_count',
			recordId: countId,
			action: 'update',
			before: { status: 'open' },
			after: { status: 'cancelled' }
		});
	});
}

/**
 * Posts the count: every difference becomes a line of one stock adjustment, posted in the same
 * transaction. A count that found nothing wrong is posted with no adjustment at all.
 */
export async function postCount(countId: number, actor: Actor) {
	const settings = await getSettings();
	const result = await transaction(async (tx) => {
		const count = await openCountOrRefuse(tx, countId);
		const lines = await countLines(countId, tx);
		const uncounted = lines.filter((l) => l.counted === null).length;
		if (uncounted) {
			throw new WriteRefused(
				null,
				uncounted === 1
					? '1 line has not been counted yet. Enter it, even if it is 0.'
					: `${uncounted} lines have not been counted yet. Enter them, even if they are 0.`
			);
		}
		const differences = lines.filter((l) => l.variance !== 0);

		let adjustmentId: number | null = null;
		let number: string | null = null;
		if (differences.length) {
			adjustmentId = await insertReturningId(tx, stockDocument, {
				type: 'adjustment',
				docDate: count.countDate,
				fromLocationId: count.locationId,
				reason: 'count',
				reference: `Count #${count.id}`,
				note: count.note,
				createdBy: actor.locals.user?.id ?? null
			});
			await tx.insert(stockDocumentLine).values(
				differences.map((d) => ({
					documentId: adjustmentId!,
					productId: d.productId,
					quantity: d.variance!,
					// Short: out of the very lot that was short. Over: into the lot it was found in.
					lotId: d.lotId,
					note: d.added ? 'Found during count' : null
				}))
			);
			({ number } = await postInTx(tx, adjustmentId, actor, settings));
		}

		await tx
			.update(stockCount)
			.set({
				status: 'posted',
				adjustmentId,
				postedAt: new Date(),
				postedBy: actor.locals.user?.id ?? null
			})
			.where(eq(stockCount.id, countId));
		await recordAudit(tx, actor, {
			table: 'stock_count',
			recordId: countId,
			action: 'update',
			before: { status: 'open' },
			after: { status: 'posted' },
			detail: { differences: differences.length }
		});
		return { adjustmentId, number, lines: differences.length };
	});
	invalidate('catalog');
	return result;
}
