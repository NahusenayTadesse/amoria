import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { stockLot } from '$lib/server/db/schema';
import {
	actorFor,
	balanceOf,
	makeLocation,
	makeLot,
	makeProduct,
	resetDb,
	stockOf
} from '$lib/server/testing/db';
import { defaultPlace, move, places } from './ledger';
import { postDocument } from './post';
import { draftQuarantine, draftWriteOff, expiryReport, setLotStatus } from './expiry';

beforeEach(resetDb);

const actor = actorFor(null);
const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;

async function stockedLot(qty: number, expiresInDays: number, locationId?: number) {
	const shop = locationId ?? (await shopFloor());
	const p = await makeProduct({ stockQty: 0, trackLots: true });
	const lot = await makeLot(p, { expiresInDays });
	await db.transaction((tx) =>
		move(tx, { productId: p, delta: qty, reason: 'delivery', locationId: shop, lotId: lot })
	);
	return { p, lot, shop };
}

describe('expiryReport', () => {
	it('lists expired and expiring lots, soonest first, and leaves the rest out', async () => {
		const gone = await stockedLot(3, -2);
		const soon = await stockedLot(4, 10);
		await stockedLot(5, 200);
		const rows = await expiryReport({ warningDays: 30 });
		expect(rows.map((r) => [r.lotId, r.state, r.quantity])).toEqual([
			[gone.lot, 'expired', 3],
			[soon.lot, 'expiring', 4]
		]);
		expect(rows[1].daysLeft).toBe(10);
	});

	it('includes a lot a person pulled or recalled, whatever its date', async () => {
		const a = await stockedLot(2, 300);
		await setLotStatus(a.lot, 'recalled', 'Supplier recall', actor);
		const rows = await expiryReport({ warningDays: 30 });
		expect(rows.map((r) => [r.lotId, r.state])).toEqual([[a.lot, 'flagged']]);
		await setLotStatus(a.lot, 'available', null, actor);
		expect(await expiryReport({ warningDays: 30 })).toHaveLength(0);
		const [lot] = await db.select().from(stockLot).where(eq(stockLot.id, a.lot));
		expect(lot.status).toBe('available');
	});

	it('is limited to one location on request', async () => {
		await shopFloor();
		const store = await makeLocation();
		const there = await stockedLot(2, -1, store);
		await stockedLot(2, -1);
		const rows = await expiryReport({ locationId: store, warningDays: 0 });
		expect(rows.map((r) => r.lotId)).toEqual([there.lot]);
	});
});

describe('quarantine and write-off drafts', () => {
	it('moves expired stock into a quarantine location that is made on first use', async () => {
		const gone = await stockedLot(3, -2);
		await stockedLot(4, 100);
		const draft = await draftQuarantine(gone.shop, actor);
		await postDocument(draft, actor);
		const [quarantine] = await db.query.location.findMany({
			where: (l, { eq }) => eq(l.kind, 'quarantine')
		});
		expect(quarantine).toBeDefined();
		expect(await balanceOf(gone.p, quarantine.id, gone.lot)).toBe(3);
		expect(await stockOf(gone.p)).toBe(0);
	});

	it('writes expired stock off as an expiry adjustment', async () => {
		const gone = await stockedLot(3, -2);
		await postDocument(await draftWriteOff(gone.shop, actor), actor);
		expect(await balanceOf(gone.p, gone.shop, gone.lot)).toBe(0);
		const rows = await db.query.stockMovement.findMany({
			where: (m, { eq, and }) => and(eq(m.productId, gone.p), eq(m.reason, 'expiry'))
		});
		expect(rows.map((r) => r.delta)).toEqual([-3]);
	});

	it('says so when nothing has expired', async () => {
		const ok = await stockedLot(3, 100);
		await expect(draftQuarantine(ok.shop, actor)).rejects.toThrow(/Nothing there has expired/);
		await expect(draftWriteOff(ok.shop, actor)).rejects.toThrow(/Nothing there has expired/);
	});
});
