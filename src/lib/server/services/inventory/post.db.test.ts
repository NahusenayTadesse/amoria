import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	product,
	stockDocument,
	stockDocumentLine,
	stockLot,
	stockMovement
} from '$lib/server/db/schema';
import {
	actorFor,
	balanceOf,
	dayFromNow,
	makeLocation,
	makeLot,
	makeProduct,
	makeStaff,
	makeSupplier,
	resetDb,
	setSettings,
	stockOf
} from '$lib/server/testing/db';
import { cancelDocument, draftReturn, saveDocument, type DocLineInput } from './documents';
import { defaultPlace, places } from './ledger';
import { postDocument } from './post';

beforeEach(resetDb);

const today = () => dayFromNow(0);
const actor = actorFor(null);
const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;

async function draft(
	header: Omit<Parameters<typeof saveDocument>[0]['header'], 'docDate'>,
	lines: DocLineInput[]
) {
	return saveDocument({ header: { docDate: today(), ...header }, lines }, actor);
}
const docRow = async (id: number) =>
	(await db.select().from(stockDocument).where(eq(stockDocument.id, id)))[0];
const avgCost = async (id: number) =>
	(await db.select({ c: product.avgCost }).from(product).where(eq(product.id, id)))[0].c;

describe('receipts', () => {
	it('brings stock in, moves the average cost and numbers the document', async () => {
		const shop = await shopFloor();
		const supplier = await makeSupplier();
		const p = await makeProduct({ stockQty: 10, avgCost: 100 });
		const id = await draft({ type: 'receipt', toLocationId: shop, supplierId: supplier }, [
			{ productId: p, quantity: 10, unitCost: 200 }
		]);

		const { number } = await postDocument(id, actor);
		expect(number).toMatch(/^AM-GRN-\d{4}-00001$/);
		expect(await stockOf(p)).toBe(20);
		expect(await avgCost(p)).toBe(150);
		expect((await docRow(id)).status).toBe('posted');
		const [m] = await db.select().from(stockMovement).where(eq(stockMovement.documentId, id));
		expect(m).toMatchObject({
			delta: 10,
			reason: 'delivery',
			unitCost: 200,
			refType: 'document',
			refId: id
		});

		// The next receipt draws the next number.
		const id2 = await draft({ type: 'receipt', toLocationId: shop, supplierId: supplier }, [
			{ productId: p, quantity: 1 }
		]);
		expect((await postDocument(id2, actor)).number).toMatch(/-00002$/);
	});

	it('refuses a receipt with no supplier, and one already posted', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 0 });
		const id = await draft({ type: 'receipt', toLocationId: shop }, [
			{ productId: p, quantity: 3 }
		]);
		await expect(postDocument(id, actor)).rejects.toThrow(/who delivered/);

		const supplier = await makeSupplier();
		const ok = await draft({ type: 'receipt', toLocationId: shop, supplierId: supplier }, [
			{ productId: p, quantity: 3 }
		]);
		await postDocument(ok, actor);
		await expect(postDocument(ok, actor)).rejects.toThrow(/already posted/);
		expect(await stockOf(p)).toBe(3);
	});

	it('needs a lot number for a lot-tracked product, and refuses an expired one', async () => {
		const shop = await shopFloor();
		const supplier = await makeSupplier();
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const base = { type: 'receipt' as const, toLocationId: shop, supplierId: supplier };

		const noLot = await draft(base, [{ productId: p, quantity: 5 }]);
		await expect(postDocument(noLot, actor)).rejects.toThrow(/lot number/);

		const old = await draft(base, [
			{ productId: p, quantity: 5, lotNumber: 'OLD', expiryDate: dayFromNow(-1) }
		]);
		await expect(postDocument(old, actor)).rejects.toThrow(/past its expiry/);

		const good = await draft(base, [
			{ productId: p, quantity: 5, lotNumber: 'B1', expiryDate: dayFromNow(60) }
		]);
		await postDocument(good, actor);
		const [lot] = await db.select().from(stockLot).where(eq(stockLot.productId, p));
		expect(lot).toMatchObject({ lotNumber: 'B1', supplierId: supplier });
		expect(await balanceOf(p, shop, lot.id)).toBe(5);

		// The same lot again adds to it; a different expiry for the same lot number is refused.
		const again = await draft(base, [
			{ productId: p, quantity: 2, lotNumber: 'B1', expiryDate: dayFromNow(60) }
		]);
		await postDocument(again, actor);
		expect(await balanceOf(p, shop, lot.id)).toBe(7);
		const clash = await draft(base, [
			{ productId: p, quantity: 2, lotNumber: 'B1', expiryDate: dayFromNow(90) }
		]);
		await expect(postDocument(clash, actor)).rejects.toThrow(/already on record/);
	});

	it('follows a purchase order to received', async () => {
		const { purchaseOrder, purchaseOrderLine } = await import('$lib/server/db/schema');
		const shop = await shopFloor();
		const supplier = await makeSupplier();
		const p = await makeProduct({ stockQty: 0 });
		const [{ id: poId }] = await db
			.insert(purchaseOrder)
			.values({ supplierId: supplier, orderDate: today(), locationId: shop, status: 'ordered' })
			.$returningId();
		const [{ id: lineId }] = await db
			.insert(purchaseOrderLine)
			.values({ purchaseOrderId: poId, productId: p, quantity: 10 })
			.$returningId();

		const first = await draft(
			{ type: 'receipt', toLocationId: shop, supplierId: supplier, purchaseOrderId: poId },
			[{ productId: p, quantity: 4, purchaseOrderLineId: lineId }]
		);
		await postDocument(first, actor);
		const status = async () =>
			(await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, poId)))[0].status;
		expect(await status()).toBe('partially_received');

		const second = await draft(
			{ type: 'receipt', toLocationId: shop, supplierId: supplier, purchaseOrderId: poId },
			[{ productId: p, quantity: 6, purchaseOrderLineId: lineId }]
		);
		await postDocument(second, actor);
		expect(await status()).toBe('received');
	});
});

describe('issues', () => {
	it('refuses more than the shelf holds and writes nothing', async () => {
		const shop = await shopFloor();
		const a = await makeProduct({ stockQty: 5, name: 'Ribbon' });
		const b = await makeProduct({ stockQty: 1, name: 'Glue' });
		const id = await draft({ type: 'issue', fromLocationId: shop, party: 'Wedding crew' }, [
			{ productId: a, quantity: 2 },
			{ productId: b, quantity: 3 }
		]);
		await expect(postDocument(id, actor)).rejects.toThrow(/Only 1 of Glue/);
		expect(await stockOf(a)).toBe(5);
		expect((await docRow(id)).status).toBe('draft');
	});

	it('issues from the location named, first expiry first', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const supplier = await makeSupplier();
		const late = await draft({ type: 'receipt', toLocationId: shop, supplierId: supplier }, [
			{ productId: p, quantity: 5, lotNumber: 'LATE', expiryDate: dayFromNow(90) },
			{ productId: p, quantity: 5, lotNumber: 'SOON', expiryDate: dayFromNow(10) }
		]);
		await postDocument(late, actor);

		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: p, quantity: 7 }
		]);
		await postDocument(id, actor);
		const lots = await db.select().from(stockLot).where(eq(stockLot.productId, p));
		const soon = lots.find((l) => l.lotNumber === 'SOON')!;
		const later = lots.find((l) => l.lotNumber === 'LATE')!;
		expect(await balanceOf(p, shop, soon.id)).toBe(0);
		expect(await balanceOf(p, shop, later.id)).toBe(3);
	});
});

describe('transfers', () => {
	it('moves stock between locations, lots and all', async () => {
		const shop = await shopFloor();
		const store = await makeLocation();
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const lot = await makeLot(p, { expiresInDays: 30 });
		const supplier = await makeSupplier();
		await postDocument(
			await draft({ type: 'receipt', toLocationId: store, supplierId: supplier }, [
				{ productId: p, quantity: 8, lotId: lot }
			]),
			actor
		);

		const id = await draft({ type: 'transfer', fromLocationId: store, toLocationId: shop }, [
			{ productId: p, quantity: 3 }
		]);
		expect((await postDocument(id, actor)).number).toMatch(/^AM-TRF-/);
		expect(await balanceOf(p, store, lot)).toBe(5);
		expect(await balanceOf(p, shop, lot)).toBe(3);
		expect(await stockOf(p)).toBe(8);
	});

	it('takes stock off sale when moved into quarantine, even if expired', async () => {
		const shop = await shopFloor();
		const quarantine = await makeLocation({ kind: 'quarantine' });
		const p = await makeProduct({ stockQty: 0, trackLots: true });
		const gone = await makeLot(p, { expiresInDays: -3 });
		const supplier = await makeSupplier();
		await db.transaction(async (tx) => {
			const { move } = await import('./ledger');
			await move(tx, { productId: p, delta: 4, reason: 'delivery', locationId: shop, lotId: gone });
		});
		void supplier;

		await postDocument(
			await draft({ type: 'transfer', fromLocationId: shop, toLocationId: quarantine }, [
				{ productId: p, quantity: 4 }
			]),
			actor
		);
		expect(await balanceOf(p, quarantine, gone)).toBe(4);
		expect(await stockOf(p)).toBe(0);
	});

	it('refuses the same location on both ends', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 2 });
		const id = await draft({ type: 'transfer', fromLocationId: shop, toLocationId: shop }, [
			{ productId: p, quantity: 1 }
		]);
		await expect(postDocument(id, actor)).rejects.toThrow(/two different locations/);
	});
});

describe('adjustments', () => {
	it('writes off and brings in with the ledger reason from the document reason', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 10 });
		await postDocument(
			await draft({ type: 'adjustment', fromLocationId: shop, reason: 'damage' }, [
				{ productId: p, quantity: -3 }
			]),
			actor
		);
		await postDocument(
			await draft({ type: 'adjustment', fromLocationId: shop, reason: 'found' }, [
				{ productId: p, quantity: 2 }
			]),
			actor
		);
		expect(await stockOf(p)).toBe(9);
		const reasons = (
			await db.select().from(stockMovement).where(eq(stockMovement.productId, p))
		).map((m) => m.reason);
		expect(reasons).toEqual(['damage', 'adjustment']);
	});

	it('opening stock with a cost sets the average', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 0 });
		await postDocument(
			await draft({ type: 'adjustment', fromLocationId: shop, reason: 'opening' }, [
				{ productId: p, quantity: 6, unitCost: 50 }
			]),
			actor
		);
		expect(await avgCost(p)).toBe(50);
		expect(await stockOf(p)).toBe(6);
	});

	it('will not remove more than is there', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 1 });
		const id = await draft({ type: 'adjustment', fromLocationId: shop, reason: 'damage' }, [
			{ productId: p, quantity: -2 }
		]);
		await expect(postDocument(id, actor)).rejects.toThrow(/Only 1/);
	});
});

describe('returns', () => {
	async function soldDocument(qty: number, price = 100) {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 10, price });
		const sale = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: p, quantity: qty, unitPrice: price }
		]);
		await postDocument(sale, actor);
		return { shop, p, sale };
	}

	it('takes back only what was sold, at most once', async () => {
		const { p, sale } = await soldDocument(4);
		const back = await draftReturn(sale, actor);
		await postDocument(back, actor);
		expect(await stockOf(p)).toBe(10);

		// Everything is returned now: a second draft has nothing left.
		await expect(draftReturn(sale, actor)).rejects.toThrow(/already been returned/);
	});

	it('refuses a return larger than what is left', async () => {
		const { p, sale } = await soldDocument(4);
		const first = await draftReturn(sale, actor);
		const [line] = await db
			.select()
			.from(stockDocumentLine)
			.where(eq(stockDocumentLine.documentId, first));
		await db
			.update(stockDocumentLine)
			.set({ quantity: 3 })
			.where(eq(stockDocumentLine.id, line.id));
		await postDocument(first, actor);

		// One unit is still returnable; a hand-made draft for two is refused.
		const over = await saveDocument(
			{
				header: {
					type: 'sales_return',
					docDate: today(),
					returnOfId: sale,
					toLocationId: (await docRow(sale)).fromLocationId
				},
				lines: [{ productId: p, quantity: 2, returnOfLineId: line.returnOfLineId }]
			},
			actor
		);
		await expect(postDocument(over, actor)).rejects.toThrow(/only 1 can still be returned/);
	});

	it('sends a delivery back to the supplier', async () => {
		const shop = await shopFloor();
		const supplier = await makeSupplier();
		const p = await makeProduct({ stockQty: 0 });
		const receipt = await draft({ type: 'receipt', toLocationId: shop, supplierId: supplier }, [
			{ productId: p, quantity: 6, unitCost: 40 }
		]);
		await postDocument(receipt, actor);

		const back = await draftReturn(receipt, actor);
		await postDocument(back, actor);
		expect(await stockOf(p)).toBe(0);
		expect((await docRow(back)).number).toMatch(/^AM-PRN-/);
	});
});

describe('sales pricing and VAT', () => {
	it('adds no VAT while the shop is not registered', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 5, price: 115 });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: p, quantity: 2, unitPrice: 115 }
		]);
		await postDocument(id, actor);
		expect(await docRow(id)).toMatchObject({ subtotal: 230, vatTotal: 0, total: 230 });
	});

	it('takes VAT out of a VAT-inclusive price, and only on standard-rated products', async () => {
		await setSettings({ vatRegistered: true, vatRate: 15, pricesIncludeVat: true });
		const shop = await shopFloor();
		const taxed = await makeProduct({ stockQty: 5, price: 115 });
		const exempt = await makeProduct({ stockQty: 5, price: 50, taxCode: 'exempt' });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: taxed, quantity: 1, unitPrice: 115 },
			{ productId: exempt, quantity: 2, unitPrice: 50 }
		]);
		await postDocument(id, actor);
		expect(await docRow(id)).toMatchObject({ subtotal: 200, vatTotal: 15, total: 215 });
		const lines = await db
			.select()
			.from(stockDocumentLine)
			.where(eq(stockDocumentLine.documentId, id));
		expect(lines.map((l) => l.vatRate)).toEqual([15, null]);
	});

	it('adds VAT on top when prices exclude it', async () => {
		await setSettings({ vatRegistered: true, vatRate: 15, pricesIncludeVat: false });
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 5, price: 100 });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: p, quantity: 2, unitPrice: 100 }
		]);
		await postDocument(id, actor);
		expect(await docRow(id)).toMatchObject({ subtotal: 200, vatTotal: 30, total: 230 });
	});

	it('needs a price on every line of a sale', async () => {
		const shop = await shopFloor();
		const a = await makeProduct({ stockQty: 5 });
		const b = await makeProduct({ stockQty: 5 });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: a, quantity: 1, unitPrice: 10 },
			{ productId: b, quantity: 1 }
		]);
		await expect(postDocument(id, actor)).rejects.toThrow(/needs a price/);
	});
});

describe('drafts', () => {
	it('edits a draft, keeps its type, and cancels without deleting', async () => {
		const shop = await shopFloor();
		const staff = await makeStaff();
		const p = await makeProduct({ stockQty: 5 });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: p, quantity: 1 }
		]);
		await saveDocument(
			{
				id,
				header: { type: 'issue', docDate: today(), fromLocationId: shop, party: 'Class 4' },
				lines: [{ productId: p, quantity: 2 }]
			},
			actorFor(staff)
		);
		expect((await docRow(id)).party).toBe('Class 4');
		await expect(
			saveDocument(
				{
					id,
					header: { type: 'receipt', docDate: today() },
					lines: [{ productId: p, quantity: 1 }]
				},
				actor
			)
		).rejects.toThrow(/change its type/);

		await cancelDocument(id, actor);
		expect((await docRow(id)).status).toBe('cancelled');
		await expect(postDocument(id, actor)).rejects.toThrow(/already cancelled/);
	});

	it('leaves a line struck out while drafting off the posted document', async () => {
		const shop = await shopFloor();
		const a = await makeProduct({ stockQty: 5 });
		const b = await makeProduct({ stockQty: 5 });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: a, quantity: 1 },
			{ productId: b, quantity: 4 }
		]);
		const [struck] = await db
			.select()
			.from(stockDocumentLine)
			.where(eq(stockDocumentLine.productId, b));
		// What the kit's `childCrud` does when a line is deleted from a draft: a soft delete.
		await db
			.update(stockDocumentLine)
			.set({ deletedAt: new Date() })
			.where(eq(stockDocumentLine.id, struck.id));

		await postDocument(id, actor);
		expect(await stockOf(a)).toBe(4);
		expect(await stockOf(b)).toBe(5);
		const lines = await db
			.select()
			.from(stockDocumentLine)
			.where(eq(stockDocumentLine.documentId, id));
		expect(lines.map((l) => l.productId)).toEqual([a]);
	});

	it('will not cancel a posted document', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 5 });
		const id = await draft({ type: 'issue', fromLocationId: shop }, [
			{ productId: p, quantity: 1 }
		]);
		await postDocument(id, actor);
		await expect(cancelDocument(id, actor)).rejects.toThrow(/cannot be cancelled/);
	});
});
