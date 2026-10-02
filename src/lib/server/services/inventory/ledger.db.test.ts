import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { product, stockBalance, stockMovement } from '$lib/server/db/schema';
import {
	balanceOf,
	makeLocation,
	makeLot,
	makeProduct,
	resetDb,
	stockOf
} from '$lib/server/testing/db';
import { transaction } from '$lib/server/db/retry';
import { defaultPlace, move, places, StockShortError } from './ledger';

beforeEach(resetDb);

const run = <T>(fn: Parameters<typeof db.transaction<T>>[0]) => db.transaction(fn);
const shopFloor = async () => defaultPlace(await run((tx) => places(tx))).id;
const movements = (productId: number) =>
	db.select().from(stockMovement).where(eq(stockMovement.productId, productId));

describe('ledger.move across locations', () => {
	it('sells from the shop floor first, then the store room', async () => {
		const shop = await shopFloor();
		const store = await makeLocation({ kind: 'storage' });
		const p = await makeProduct({ stockQty: 2 });
		await run((tx) => move(tx, { productId: p, delta: 5, reason: 'delivery', locationId: store }));
		expect(await stockOf(p)).toBe(7);

		await run((tx) => move(tx, { productId: p, delta: -4, reason: 'sale' }));

		expect(await balanceOf(p, shop)).toBe(0);
		expect(await balanceOf(p, store)).toBe(3);
		expect(await stockOf(p)).toBe(3);
		const out = (await movements(p)).filter((m) => m.delta < 0);
		expect(out.map((m) => [m.locationId, m.delta])).toEqual([
			[shop, -2],
			[store, -2]
		]);
	});

	it('does not sell quarantined stock, and does not count it as sellable', async () => {
		const quarantine = await makeLocation({ kind: 'quarantine' });
		const p = await makeProduct({ stockQty: 3 });
		await run((tx) =>
			move(tx, { productId: p, delta: 4, reason: 'delivery', locationId: quarantine })
		);
		expect(await stockOf(p)).toBe(3);
		const err = await run((tx) => move(tx, { productId: p, delta: -5, reason: 'sale' })).catch(
			(e) => e
		);
		expect(err).toBeInstanceOf(StockShortError);
		expect((err as StockShortError).available).toBe(3);
		expect(await balanceOf(p, quarantine)).toBe(4);
	});

	it('moving stock into quarantine takes it off sale, and back puts it on', async () => {
		const shop = await shopFloor();
		const quarantine = await makeLocation({ kind: 'quarantine' });
		const p = await makeProduct({ stockQty: 5 });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: -2, reason: 'transfer_out', locationId: shop });
			await move(tx, { productId: p, delta: 2, reason: 'transfer_in', locationId: quarantine });
		});
		expect(await stockOf(p)).toBe(3);
		await run(async (tx) => {
			await move(tx, { productId: p, delta: -2, reason: 'transfer_out', locationId: quarantine });
			await move(tx, { productId: p, delta: 2, reason: 'transfer_in', locationId: shop });
		});
		expect(await stockOf(p)).toBe(5);
	});

	it('only takes from the location named', async () => {
		const shop = await shopFloor();
		const store = await makeLocation({ kind: 'storage' });
		const p = await makeProduct({ stockQty: 5 });
		await run((tx) => move(tx, { productId: p, delta: 5, reason: 'delivery', locationId: store }));
		const err = await run((tx) =>
			move(tx, { productId: p, delta: -6, reason: 'issue', locationId: shop })
		).catch((e) => e);
		expect(err).toBeInstanceOf(StockShortError);
		expect((err as StockShortError).available).toBe(5);
	});
});

describe('ledger.move with lots', () => {
	it('sells the lot that expires first and skips expired ones', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const late = await makeLot(p, { expiresInDays: 90 });
		const soon = await makeLot(p, { expiresInDays: 10 });
		const gone = await makeLot(p, { expiresInDays: -1 });
		for (const lotId of [late, soon, gone]) {
			await run((tx) =>
				move(tx, { productId: p, delta: 5, reason: 'delivery', locationId: shop, lotId })
			);
		}
		await run((tx) => move(tx, { productId: p, delta: -7, reason: 'sale' }));
		expect(await balanceOf(p, shop, soon)).toBe(0);
		expect(await balanceOf(p, shop, late)).toBe(3);
		expect(await balanceOf(p, shop, gone)).toBe(5);

		// Only 3 usable units remain: the expired lot is not for sale.
		const err = await run((tx) => move(tx, { productId: p, delta: -4, reason: 'sale' })).catch(
			(e) => e
		);
		expect((err as StockShortError).available).toBe(3);
	});

	it('lets a write-off reach an expired lot', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const gone = await makeLot(p, { expiresInDays: -5 });
		await run((tx) =>
			move(tx, { productId: p, delta: 4, reason: 'delivery', locationId: shop, lotId: gone })
		);
		await run((tx) =>
			move(tx, { productId: p, delta: -4, reason: 'loss', locationId: shop, allowUnusable: true })
		);
		expect(await balanceOf(p, shop, gone)).toBe(0);
		expect(await stockOf(p)).toBe(0);
	});

	it('puts a cancelled sale back into the lots and places it came from', async () => {
		const shop = await shopFloor();
		const store = await makeLocation({ kind: 'storage' });
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const a = await makeLot(p, { expiresInDays: 20 });
		const b = await makeLot(p, { expiresInDays: 60 });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: 2, reason: 'delivery', locationId: shop, lotId: a });
			await move(tx, { productId: p, delta: 5, reason: 'delivery', locationId: store, lotId: b });
			await move(tx, { productId: p, delta: -4, reason: 'sale', refType: 'order', refId: 9 });
		});
		expect(await balanceOf(p, shop, a)).toBe(0);
		expect(await balanceOf(p, store, b)).toBe(3);

		await run((tx) =>
			move(tx, { productId: p, delta: 4, reason: 'sale_cancel', refType: 'order', refId: 9 })
		);
		expect(await balanceOf(p, shop, a)).toBe(2);
		expect(await balanceOf(p, store, b)).toBe(5);
		expect(await stockOf(p)).toBe(7);

		// A second cancellation has nothing left to give back to, so it goes to the shop floor.
		await run((tx) =>
			move(tx, { productId: p, delta: 1, reason: 'sale_cancel', refType: 'order', refId: 9 })
		);
		expect(await balanceOf(p, shop)).toBe(3);
	});
});

describe('ledger.move costs', () => {
	it('moves the average only on a revalued delivery, and sells at the average', async () => {
		const p = await makeProduct({ stockQty: 10, avgCost: 100 });
		await run((tx) =>
			move(tx, { productId: p, delta: 10, reason: 'delivery', unitCost: 200, revalue: true })
		);
		const [afterIn] = await db
			.select({ avg: product.avgCost })
			.from(product)
			.where(eq(product.id, p));
		expect(afterIn.avg).toBe(150);

		// A return at its old cost does not move the average.
		await run((tx) =>
			move(tx, { productId: p, delta: 1, reason: 'customer_return', unitCost: 80 })
		);
		await run((tx) => move(tx, { productId: p, delta: -2, reason: 'sale' }));
		const [after] = await db
			.select({ avg: product.avgCost })
			.from(product)
			.where(eq(product.id, p));
		expect(after.avg).toBe(150);
		const ledger = await movements(p);
		expect(ledger.map((m) => [m.reason, m.unitCost])).toEqual([
			['delivery', 200],
			['customer_return', 80],
			['sale', 150]
		]);
	});

	it('keeps balances equal to the ledger', async () => {
		const shop = await shopFloor();
		const store = await makeLocation();
		const p = await makeProduct({ stockQty: 6 });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: 4, reason: 'delivery', locationId: store });
			await move(tx, { productId: p, delta: -3, reason: 'sale' });
			await move(tx, { productId: p, delta: -1, reason: 'damage', locationId: store });
		});
		const balances = await db.select().from(stockBalance).where(eq(stockBalance.productId, p));
		const ledgerTotal = (await movements(p)).reduce((sum, m) => sum + m.delta, 0);
		expect(balances.reduce((sum, b) => sum + b.quantity, 0)).toBe(ledgerTotal + 6);
		expect(await stockOf(p)).toBe(6);
		expect(await balanceOf(p, shop)).toBe(3);
		expect(await balanceOf(p, store)).toBe(3);
	});
});

describe('ledger.move under contention', () => {
	it('never oversells: five buyers race for three units and exactly three win', async () => {
		const shop = await shopFloor();
		const store = await makeLocation();
		const p = await makeProduct({ stockQty: 2 });
		await run((tx) => move(tx, { productId: p, delta: 1, reason: 'delivery', locationId: store }));

		const attempts = await Promise.allSettled(
			Array.from({ length: 5 }, (_, i) =>
				transaction((tx) =>
					move(tx, { productId: p, delta: -1, reason: i % 2 ? 'pos_sale' : 'sale' })
				)
			)
		);
		const won = attempts.filter((a) => a.status === 'fulfilled').length;
		const short = attempts.filter(
			(a) => a.status === 'rejected' && a.reason instanceof StockShortError
		).length;
		expect({ won, short }).toEqual({ won: 3, short: 2 });
		expect(await stockOf(p)).toBe(0);
		expect(await balanceOf(p, shop)).toBe(0);
		expect(await balanceOf(p, store)).toBe(0);
		const out = (await movements(p)).filter((m) => m.delta < 0);
		expect(out).toHaveLength(3);
	});
});
