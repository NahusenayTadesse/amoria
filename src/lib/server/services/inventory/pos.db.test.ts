import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { posPayment, stockDocument } from '$lib/server/db/schema';
import {
	actorFor,
	balanceOf,
	makeLocation,
	makeProduct,
	makeStaff,
	resetDb,
	setSettings,
	stockOf
} from '$lib/server/testing/db';
import { defaultPlace, places } from './ledger';
import {
	checkout,
	closeShift,
	currentShift,
	openShift,
	receiptView,
	returnAtTill,
	searchProducts,
	shiftSummary
} from './pos';

beforeEach(resetDb);

const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;

async function till(float = 500) {
	const staff = await makeStaff();
	const actor = actorFor(staff);
	const shiftId = await openShift({ floatAmount: float }, actor);
	return { staff, actor, shiftId };
}

describe('shifts', () => {
	it('opens once per cashier, and closes by counting the drawer', async () => {
		const { staff, actor, shiftId } = await till(500);
		expect((await currentShift(staff))?.id).toBe(shiftId);
		await expect(openShift({ floatAmount: 0 }, actor)).rejects.toThrow(/already have a till open/);

		const p = await makeProduct({ stockQty: 10, price: 200 });
		await checkout(
			{
				lines: [{ productId: p, quantity: 2 }],
				payments: [{ method: 'cash', amount: 500 }]
			},
			actor
		);
		const summary = await shiftSummary(shiftId);
		expect(summary).toMatchObject({ sales: 1, expectedCash: 900, takenTotal: 400 });

		// The drawer is 20 short.
		const closed = await closeShift(shiftId, { countedCash: 880 }, actor);
		expect(closed).toEqual({ expected: 900, counted: 880, difference: -20 });
		expect(await currentShift(staff)).toBeNull();
		await expect(closeShift(shiftId, { countedCash: 880 }, actor)).rejects.toThrow(
			/already closed/
		);
	});

	it('refuses to sell without a shift, and to sell from quarantine', async () => {
		const staff = await makeStaff();
		const p = await makeProduct({ stockQty: 5 });
		await expect(
			checkout(
				{ lines: [{ productId: p, quantity: 1 }], payments: [{ method: 'cash', amount: 100 }] },
				actorFor(staff)
			)
		).rejects.toThrow(/Open your till/);
		const q = await makeLocation({ kind: 'quarantine' });
		await expect(openShift({ floatAmount: 0, locationId: q }, actorFor(staff))).rejects.toThrow(
			/where this till sells from/
		);
	});
});

describe('checkout', () => {
	it('sells from the shop floor, takes stock, and gives change from cash only', async () => {
		const { actor } = await till();
		const shop = await shopFloor();
		const a = await makeProduct({ stockQty: 10, price: 150 });
		const b = await makeProduct({ stockQty: 3, price: 75 });

		const sale = await checkout(
			{
				lines: [
					{ productId: a, quantity: 2 },
					{ productId: b, quantity: 1 }
				],
				payments: [{ method: 'cash', amount: 400 }]
			},
			actor
		);
		expect(sale).toMatchObject({ total: 375, change: 25 });
		expect(sale.number).toMatch(/^AM-ISS-/);
		expect(await stockOf(a)).toBe(8);
		expect(await balanceOf(b, shop)).toBe(2);
		// The drawer keeps 375, not the 400 handed over.
		const pay = await db
			.select()
			.from(posPayment)
			.where(eq(posPayment.documentId, sale.documentId));
		expect(pay.map((p) => [p.method, p.amount])).toEqual([['cash', 375]]);
	});

	it('splits payment across methods', async () => {
		const { actor } = await till();
		const p = await makeProduct({ stockQty: 5, price: 300 });
		const sale = await checkout(
			{
				lines: [{ productId: p, quantity: 2 }],
				payments: [
					{ method: 'telebirr', amount: 350, reference: 'TB123' },
					{ method: 'cash', amount: 250 }
				]
			},
			actor
		);
		expect(sale).toMatchObject({ total: 600, change: 0 });
	});

	it('refuses underpayment and change on a non-cash payment', async () => {
		const { actor } = await till();
		const p = await makeProduct({ stockQty: 5, price: 100 });
		const lines = [{ productId: p, quantity: 1 }];
		await expect(
			checkout({ lines, payments: [{ method: 'cash', amount: 60 }] }, actor)
		).rejects.toThrow(/ETB 40.00 is still to pay/);
		await expect(
			checkout({ lines, payments: [{ method: 'telebirr', amount: 150 }] }, actor)
		).rejects.toThrow(/Only cash gives change/);
		expect(await stockOf(p)).toBe(5);
	});

	it('is atomic: a shortage leaves no sale, no payment, no stock change', async () => {
		const { actor } = await till();
		const a = await makeProduct({ stockQty: 5, price: 100 });
		const b = await makeProduct({ stockQty: 1, price: 100, name: 'Last one' });
		await expect(
			checkout(
				{
					lines: [
						{ productId: a, quantity: 2 },
						{ productId: b, quantity: 2 }
					],
					payments: [{ method: 'cash', amount: 400 }]
				},
				actor
			)
		).rejects.toThrow(/Only 1 of Last one/);
		expect(await stockOf(a)).toBe(5);
		expect(await db.select().from(posPayment)).toHaveLength(0);
		expect(await db.select().from(stockDocument)).toHaveLength(0);
	});

	it('needs permission to change the shelf price, up or down', async () => {
		const { actor } = await till();
		const p = await makeProduct({ stockQty: 5, price: 100 });
		const input = {
			lines: [{ productId: p, quantity: 1, unitPrice: 80 }],
			payments: [{ method: 'cash' as const, amount: 100 }]
		};
		await expect(checkout(input, actor)).rejects.toThrow(/Changing it needs permission/);
		await expect(
			checkout({ ...input, lines: [{ productId: p, quantity: 1, unitPrice: 120 }] }, actor)
		).rejects.toThrow(/Changing it needs permission/);
		const sale = await checkout({ ...input, canDiscount: true }, actor);
		expect(sale.total).toBe(80);
		const view = await receiptView(sale.documentId);
		expect(view!.lines[0]).toMatchObject({ unitPrice: 80, listPrice: 100, lineTotal: 80 });
	});

	it('does not sell rental equipment or materials at the till', async () => {
		const { actor } = await till();
		const tent = await makeProduct({ kind: 'rental', price: null, dailyRate: 500, stockQty: 2 });
		await expect(
			checkout(
				{ lines: [{ productId: tent, quantity: 1 }], payments: [{ method: 'cash', amount: 500 }] },
				actor
			)
		).rejects.toThrow(/not sold at the till/);
	});

	it('shows VAT on the receipt when the shop is registered', async () => {
		await setSettings({ vatRegistered: true, vatRate: 15, pricesIncludeVat: true });
		const { actor } = await till();
		const p = await makeProduct({ stockQty: 5, price: 115 });
		const sale = await checkout(
			{ lines: [{ productId: p, quantity: 1 }], payments: [{ method: 'cash', amount: 115 }] },
			actor
		);
		const view = await receiptView(sale.documentId);
		expect(view!.doc).toMatchObject({ subtotal: 100, vatTotal: 15, total: 115 });
		expect(view!.lines[0].vatRate).toBe(15);
		expect(view!.vatRegistered).toBe(true);
	});
});

describe('returns at the till', () => {
	it('puts goods back and pays the refund out of the drawer', async () => {
		const { actor, shiftId } = await till(500);
		const p = await makeProduct({ stockQty: 10, price: 200 });
		const sale = await checkout(
			{ lines: [{ productId: p, quantity: 3 }], payments: [{ method: 'cash', amount: 600 }] },
			actor
		);
		const [line] = await db.query.stockDocumentLine.findMany({
			where: (l, { eq }) => eq(l.documentId, sale.documentId)
		});

		const back = await returnAtTill(
			{ originalId: sale.documentId, lines: [{ lineId: line.id, quantity: 1 }] },
			actor
		);
		expect(back.refund).toBe(200);
		expect(back.number).toMatch(/^AM-SRN-/);
		expect(await stockOf(p)).toBe(8);
		// Float 500 + 600 taken − 200 refunded.
		expect((await shiftSummary(shiftId)).expectedCash).toBe(900);

		await expect(
			returnAtTill(
				{ originalId: sale.documentId, lines: [{ lineId: line.id, quantity: 3 }] },
				actor
			)
		).rejects.toThrow(/only 2 can still be returned/);
	});
});

describe('searchProducts', () => {
	it('finds an exact barcode first, then names, and reports what is on the floor', async () => {
		const shop = await shopFloor();
		const scarf = await makeProduct({ name: 'Silk scarf', barcode: '2000000000015', stockQty: 4 });
		await makeProduct({ name: 'Scarf pin', stockQty: 0 });
		await makeProduct({ name: 'Rose', kind: 'rental', price: null, dailyRate: 10, stockQty: 1 });

		const byBarcode = await searchProducts('2000000000015', shop);
		expect(byBarcode).toHaveLength(1);
		expect(byBarcode[0]).toMatchObject({ id: scarf, onFloor: 4 });

		const byName = await searchProducts('scarf', shop);
		expect(byName.map((r) => r.name)).toEqual(['Scarf pin', 'Silk scarf']);
		expect(await searchProducts('rose', shop)).toHaveLength(0); // rental: not for the till
		expect(await searchProducts('   ', shop)).toEqual([]);
	});
});
