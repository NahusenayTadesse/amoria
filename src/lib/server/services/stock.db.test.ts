import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { auditLog, stockMovement } from '$lib/server/db/schema';
import { actorFor, makeProduct, makeStaff, resetDb, stockOf } from '$lib/server/testing/db';
import { MANUAL_REASONS, STOCK_REASON_META } from '$lib/stock';
import { adjustStock, move, StockShortError } from './stock';

beforeEach(resetDb);

const ledgerOf = (productId: number) =>
	db.select().from(stockMovement).where(eq(stockMovement.productId, productId));

describe('move', () => {
	it('writes the ledger row and the new quantity together', async () => {
		const p = await makeProduct({ stockQty: 5 });
		const after = await db.transaction((tx) =>
			move(tx, { productId: p, delta: -2, reason: 'sale', refType: 'order', refId: 7 })
		);
		expect(after).toBe(3);
		expect(await stockOf(p)).toBe(3);
		const [row] = await ledgerOf(p);
		expect(row).toMatchObject({ delta: -2, reason: 'sale', refType: 'order', refId: 7 });
	});

	it('refuses to go below zero and writes nothing', async () => {
		const p = await makeProduct({ stockQty: 1 });
		const err = await db
			.transaction((tx) => move(tx, { productId: p, delta: -2, reason: 'sale' }))
			.catch((e) => e);
		expect(err).toBeInstanceOf(StockShortError);
		expect((err as StockShortError).available).toBe(1);
		expect(await stockOf(p)).toBe(1);
		expect(await ledgerOf(p)).toHaveLength(0);
	});

	it('works the same for rental equipment as for gifts (one ledger, site-wide)', async () => {
		const tent = await makeProduct({ kind: 'rental', price: null, dailyRate: 500, stockQty: 4 });
		await db.transaction((tx) => move(tx, { productId: tent, delta: -1, reason: 'damage' }));
		expect(await stockOf(tent)).toBe(3);
	});
});

describe('adjustStock', () => {
	it('takes the direction from the reason, not the sign the form sent', async () => {
		const staff = await makeStaff();
		const p = await makeProduct({ stockQty: 5 });

		await adjustStock(
			p,
			{ mode: 'move', reason: 'damage', qty: 2, note: 'Cracked' },
			actorFor(staff)
		);
		expect(await stockOf(p)).toBe(3);
		// A negative number on an "in" reason still adds.
		await adjustStock(
			p,
			{ mode: 'move', reason: 'delivery', qty: -4, note: null },
			actorFor(staff)
		);
		expect(await stockOf(p)).toBe(7);

		const ledger = await ledgerOf(p);
		expect(ledger.map((m) => [m.reason, m.delta, m.createdBy, m.note])).toEqual([
			['damage', -2, staff, 'Cracked'],
			['delivery', 4, staff, null]
		]);
	});

	it('lets a correction go either way', async () => {
		const p = await makeProduct({ stockQty: 5 });
		await adjustStock(
			p,
			{ mode: 'move', reason: 'adjustment', qty: -1, note: null },
			actorFor(null)
		);
		await adjustStock(
			p,
			{ mode: 'move', reason: 'adjustment', qty: 3, note: null },
			actorFor(null)
		);
		expect(await stockOf(p)).toBe(7);
	});

	it('records a stock count as the difference, marked as a count', async () => {
		const p = await makeProduct({ stockQty: 5 });
		await adjustStock(p, { mode: 'count', counted: 2, note: null }, actorFor(null));
		expect(await stockOf(p)).toBe(2);
		const [row] = await ledgerOf(p);
		expect(row).toMatchObject({ reason: 'adjustment', delta: -3, refType: 'count' });
	});

	it('audits every adjustment with the quantities before and after', async () => {
		const staff = await makeStaff();
		const p = await makeProduct({ stockQty: 5 });
		await adjustStock(p, { mode: 'move', reason: 'loss', qty: 1, note: null }, actorFor(staff));
		const [entry] = await db.select().from(auditLog);
		expect(entry).toMatchObject({ tableName: 'product', recordId: String(p), userId: staff });
		expect(entry.changes).toMatchObject({ stockQty: [5, 4], reason: 'loss' });
	});

	it.each([
		['a count equal to what is on record', { mode: 'count', counted: 5, note: null }, 'counted'],
		['a zero quantity', { mode: 'move', reason: 'delivery', qty: 0, note: null }, 'qty'],
		['more than is on record', { mode: 'move', reason: 'damage', qty: 9, note: null }, 'qty'],
		[
			'a count below zero… as the difference',
			{ mode: 'count', counted: -1, note: null },
			'counted'
		],
		[
			'a reason only the system writes',
			{ mode: 'move', reason: 'sale', qty: 1, note: null },
			'reason'
		]
	] as const)('refuses %s, under the right field', async (_label, input, field) => {
		const p = await makeProduct({ stockQty: 5 });
		const err = await adjustStock(p, input, actorFor(null)).catch((e) => e);
		expect(err).toBeInstanceOf(WriteRefused);
		expect((err as WriteRefused).field).toBe(field);
		expect(await stockOf(p)).toBe(5);
		expect(await ledgerOf(p)).toHaveLength(0);
	});

	it('refuses a product that does not exist', async () => {
		await expect(
			adjustStock(999_999, { mode: 'move', reason: 'delivery', qty: 1, note: null }, actorFor(null))
		).rejects.toThrow(/does not exist/);
	});
});

describe('the reason table', () => {
	it('offers staff only reasons they may record, each with a direction', () => {
		expect(MANUAL_REASONS).toEqual(['delivery', 'opening', 'damage', 'loss', 'adjustment']);
		for (const reason of MANUAL_REASONS) {
			expect(['in', 'out', 'either']).toContain(STOCK_REASON_META[reason].direction);
		}
		expect(STOCK_REASON_META.sale.manual).toBe(false);
		expect(STOCK_REASON_META.sale_cancel.manual).toBe(false);
	});
});
