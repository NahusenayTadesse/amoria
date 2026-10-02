import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { stockCount, stockDocument } from '$lib/server/db/schema';
import {
	actorFor,
	balanceOf,
	dayFromNow,
	makeLocation,
	makeLot,
	makeProduct,
	resetDb,
	stockOf
} from '$lib/server/testing/db';
import { defaultPlace, move, places } from './ledger';
import {
	addFoundLine,
	cancelCount,
	countLines,
	movedSinceOpened,
	openCount,
	postCount,
	saveCounts
} from './counts';

beforeEach(resetDb);

const actor = actorFor(null);
const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;
const open = async (locationId: number, blind = true) =>
	openCount({ locationId, blind, countDate: dayFromNow(0) }, actor);

describe('stock counts', () => {
	it('snapshots what the system expects, and posts the differences as one adjustment', async () => {
		const shop = await shopFloor();
		const a = await makeProduct({ stockQty: 10, avgCost: 20 });
		const b = await makeProduct({ stockQty: 5 });
		const c = await makeProduct({ stockQty: 4 });
		const id = await open(shop);

		const lines = await countLines(id);
		expect(lines.map((l) => [l.productId, l.expected, l.counted])).toEqual(
			expect.arrayContaining([
				[a, 10, null],
				[b, 5, null],
				[c, 4, null]
			])
		);

		// Cannot post until every line is counted.
		await expect(postCount(id, actor)).rejects.toThrow(/3 lines have not been counted/);

		const line = (p: number) => lines.find((l) => l.productId === p)!.id;
		await saveCounts(
			id,
			[
				{ lineId: line(a), counted: 7 },
				{ lineId: line(b), counted: 5 },
				{ lineId: line(c), counted: 6 }
			],
			actor
		);
		const withVariance = await countLines(id);
		expect(withVariance.find((l) => l.productId === a)).toMatchObject({
			variance: -3,
			varianceValue: -60
		});

		const result = await postCount(id, actor);
		expect(result.lines).toBe(2);
		expect(result.number).toMatch(/^AM-ADJ-/);
		expect(await stockOf(a)).toBe(7);
		expect(await stockOf(b)).toBe(5);
		expect(await stockOf(c)).toBe(6);
		const [count] = await db.select().from(stockCount).where(eq(stockCount.id, id));
		expect(count).toMatchObject({ status: 'posted', adjustmentId: result.adjustmentId });
		const [doc] = await db
			.select()
			.from(stockDocument)
			.where(eq(stockDocument.id, result.adjustmentId!));
		expect(doc).toMatchObject({ reason: 'count', status: 'posted' });
	});

	it('posts a count that found nothing wrong without an adjustment', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 3 });
		const id = await open(shop);
		const [line] = await countLines(id);
		await saveCounts(id, [{ lineId: line.id, counted: 3 }], actor);
		expect(await postCount(id, actor)).toMatchObject({ adjustmentId: null, lines: 0 });
		expect(await stockOf(p)).toBe(3);
		await expect(postCount(id, actor)).rejects.toThrow(/already posted/);
	});

	it('records a lot that is short against that lot, and stock found during the count', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const lot = await makeLot(p, { expiresInDays: 30 });
		await db.transaction((tx) =>
			move(tx, { productId: p, delta: 6, reason: 'delivery', locationId: shop, lotId: lot })
		);
		const extra = await makeProduct({ stockQty: 0 });
		const id = await open(shop);
		const [line] = await countLines(id);
		await saveCounts(id, [{ lineId: line.id, counted: 4 }], actor);
		await addFoundLine({ countId: id, productId: extra, counted: 2 }, actor);
		await expect(
			addFoundLine({ countId: id, productId: extra, counted: 2 }, actor)
		).rejects.toThrow(/already on this count/);
		await expect(addFoundLine({ countId: id, productId: p, counted: 1 }, actor)).rejects.toThrow(
			/tracks lots/
		);

		await postCount(id, actor);
		expect(await balanceOf(p, shop, lot)).toBe(4);
		expect(await stockOf(extra)).toBe(2);
	});

	it('takes a shortage from the bucket that was short, not from a lot by expiry', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 6, trackLots: true }); // 6 with no lot
		const lot = await makeLot(p, { expiresInDays: 30 });
		await db.transaction((tx) =>
			move(tx, { productId: p, delta: 12, reason: 'delivery', locationId: shop, lotId: lot })
		);
		const id = await open(shop);
		const lines = await countLines(id);
		const plain = lines.find((l) => l.lotId === null)!;
		const lotted = lines.find((l) => l.lotId === lot)!;
		await saveCounts(
			id,
			[
				{ lineId: plain.id, counted: 1 }, // 5 short with no lot
				{ lineId: lotted.id, counted: 12 } // the lot is right
			],
			actor
		);
		await postCount(id, actor);
		expect(await balanceOf(p, shop, lot)).toBe(12);
		expect(await balanceOf(p, shop, null)).toBe(1);
	});

	it('warns when stock moved after the count was opened', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 5 });
		const id = await open(shop);
		expect(await movedSinceOpened(id)).toBe(0);
		await new Promise((r) => setTimeout(r, 1100));
		await db.transaction((tx) => move(tx, { productId: p, delta: -1, reason: 'sale' }));
		expect(await movedSinceOpened(id)).toBe(1);
	});

	it('allows one open count per location, and a cancelled one is out of the way', async () => {
		const shop = await shopFloor();
		const other = await makeLocation();
		await makeProduct({ stockQty: 1 });
		const id = await open(shop);
		await expect(open(shop)).rejects.toThrow(/still open/);
		await open(other);
		await cancelCount(id, actor);
		const [count] = await db.select().from(stockCount).where(eq(stockCount.id, id));
		expect(count.status).toBe('cancelled');
		await open(shop);
	});

	it('rejects a negative or fractional count', async () => {
		const shop = await shopFloor();
		await makeProduct({ stockQty: 1 });
		const id = await open(shop);
		const [line] = await countLines(id);
		await expect(saveCounts(id, [{ lineId: line.id, counted: -1 }], actor)).rejects.toThrow(
			/whole number/
		);
		await expect(saveCounts(id, [{ lineId: line.id, counted: 1.5 }], actor)).rejects.toThrow(
			/whole number/
		);
	});
});
