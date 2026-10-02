import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { purchaseOrder, purchaseOrderLine } from '$lib/server/db/schema';
import {
	actorFor,
	dayFromNow,
	makeProduct,
	makeSupplier,
	resetDb,
	setSettings
} from '$lib/server/testing/db';
import { defaultPlace, move, places } from './ledger';
import { postDocument } from './post';
import {
	cancelOrder,
	closeOrder,
	draftReceiptFromOrder,
	markOrdered,
	ordersFromReorder,
	reorderSuggestions,
	saveOrder
} from './purchasing';

beforeEach(resetDb);

const actor = actorFor(null);
const today = () => dayFromNow(0);
const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;
const orderRow = async (id: number) =>
	(await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, id)))[0];

async function placedOrder(lines: { productId: number; quantity: number; unitCost?: number }[]) {
	const supplierId = await makeSupplier();
	const locationId = await shopFloor();
	const id = await saveOrder(
		{ header: { supplierId, orderDate: today(), locationId }, lines },
		actor
	);
	await markOrdered(id, actor);
	return { id, supplierId };
}

describe('purchase orders', () => {
	it('drafts, numbers when ordered, and then stops being editable', async () => {
		const p = await makeProduct({ stockQty: 0 });
		const supplierId = await makeSupplier();
		const locationId = await shopFloor();
		const header = { supplierId, orderDate: today(), locationId };
		const id = await saveOrder({ header, lines: [{ productId: p, quantity: 5 }] }, actor);
		expect((await orderRow(id)).number).toBeNull();

		// A draft can be reworked freely.
		await saveOrder({ id, header, lines: [{ productId: p, quantity: 8, unitCost: 30 }] }, actor);
		const [line] = await db
			.select()
			.from(purchaseOrderLine)
			.where(eq(purchaseOrderLine.purchaseOrderId, id));
		expect(line).toMatchObject({ quantity: 8, unitCost: 30 });

		expect(await markOrdered(id, actor)).toMatch(/^AM-PO-\d{4}-00001$/);
		expect((await orderRow(id)).status).toBe('ordered');
		await expect(
			saveOrder({ id, header, lines: [{ productId: p, quantity: 1 }] }, actor)
		).rejects.toThrow(/Only a draft/);
		await expect(markOrdered(id, actor)).rejects.toThrow(/already placed/);
	});

	it('refuses empty orders and zero quantities', async () => {
		const supplierId = await makeSupplier();
		const locationId = await shopFloor();
		const header = { supplierId, orderDate: today(), locationId };
		await expect(saveOrder({ header, lines: [] }, actor)).rejects.toThrow(/at least one line/);
		const p = await makeProduct({ stockQty: 0 });
		await expect(
			saveOrder({ header, lines: [{ productId: p, quantity: 0 }] }, actor)
		).rejects.toThrow(/quantity of at least 1/);
	});

	it('receives what is due, in parts, at the agreed price', async () => {
		const a = await makeProduct({ stockQty: 0 });
		const b = await makeProduct({ stockQty: 0 });
		const { id } = await placedOrder([
			{ productId: a, quantity: 10, unitCost: 25 },
			{ productId: b, quantity: 4, unitCost: 60 }
		]);

		const first = await draftReceiptFromOrder(id, actor);
		const lines = await db.query.stockDocumentLine.findMany({
			where: (l, { eq }) => eq(l.documentId, first)
		});
		expect(lines.map((l) => [l.productId, l.quantity, l.unitCost])).toEqual([
			[a, 10, 25],
			[b, 4, 60]
		]);
		// Only 6 of the 10 arrive.
		await db
			.update((await import('$lib/server/db/schema')).stockDocumentLine)
			.set({ quantity: 6 })
			.where(eq((await import('$lib/server/db/schema')).stockDocumentLine.id, lines[0].id));
		await postDocument(first, actor);
		expect((await orderRow(id)).status).toBe('partially_received');

		// The next receipt drafts what is still due: 4 of a, and b is done.
		const second = await draftReceiptFromOrder(id, actor);
		const due = await db.query.stockDocumentLine.findMany({
			where: (l, { eq }) => eq(l.documentId, second)
		});
		expect(due.map((l) => [l.productId, l.quantity])).toEqual([[a, 4]]);
		await postDocument(second, actor);
		expect((await orderRow(id)).status).toBe('received');
		await expect(draftReceiptFromOrder(id, actor)).rejects.toThrow(/not yet complete/);
	});

	it('cancels an order nothing has arrived on, and closes one that is part-received', async () => {
		const p = await makeProduct({ stockQty: 0 });
		const { id } = await placedOrder([{ productId: p, quantity: 5 }]);
		await cancelOrder(id, actor);
		expect((await orderRow(id)).status).toBe('cancelled');
		await expect(cancelOrder(id, actor)).rejects.toThrow(/already cancelled/);

		const { id: other } = await placedOrder([{ productId: p, quantity: 5 }]);
		const receipt = await draftReceiptFromOrder(other, actor);
		await postDocument(receipt, actor);
		await expect(cancelOrder(other, actor)).rejects.toThrow(/Close it instead/);
		await closeOrder(other, actor);
		expect((await orderRow(other)).status).toBe('closed');
	});
});

describe('reorderSuggestions', () => {
	it('lists products at or under their level, and suggests up to twice the level', async () => {
		await setSettings({ lowStockDefault: 3 });
		const low = await makeProduct({ stockQty: 2, name: 'Low' });
		await makeProduct({ stockQty: 20, name: 'Plenty' });
		const own = await makeProduct({ stockQty: 8, lowStockThreshold: 10, name: 'Own level' });

		const list = await reorderSuggestions();
		expect(list.map((r) => r.name).sort()).toEqual(['Low', 'Own level']);
		const lowRow = list.find((r) => r.id === low)!;
		expect(lowRow).toMatchObject({ reorderLevel: 3, onHand: 2, suggested: 4, belowMin: true });
		expect(list.find((r) => r.id === own)).toMatchObject({ reorderLevel: 10, suggested: 12 });
	});

	it('subtracts what is already on order', async () => {
		await setSettings({ lowStockDefault: 3 });
		const p = await makeProduct({ stockQty: 1 });
		await placedOrder([{ productId: p, quantity: 4 }]);
		const [row] = await reorderSuggestions();
		// Twice the level is 6; 1 on hand + 4 on order leaves 1 to add.
		expect(row).toMatchObject({ onOrder: 4, suggested: 1 });
	});

	it('flags a product that will run out before a delivery could arrive', async () => {
		await setSettings({ lowStockDefault: 0 });
		const p = await makeProduct({ stockQty: 30 });
		// Sells about 2 a day; with a 7-day lead time the 10 left runs short of the week.
		for (let i = 10; i >= 1; i--) {
			await db.transaction((tx) =>
				move(tx, { productId: p, delta: -3, reason: 'sale', docDate: dayFromNow(-i) })
			);
		}
		await db.transaction((tx) => move(tx, { productId: p, delta: 10, reason: 'delivery' }));
		const [row] = await reorderSuggestions();
		expect(row.id).toBe(p);
		expect(row.runsOut).toBe(true);
		expect(row.belowMin).toBe(false);
		expect(row.suggested).toBeGreaterThan(0);
	});

	it('plans for one location from its own rule', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 4 });
		await db
			.insert((await import('$lib/server/db/schema')).reorderRule)
			.values({ productId: p, locationId: shop, minQuantity: 5, maxQuantity: 12 });
		const [row] = await reorderSuggestions({ locationId: shop });
		expect(row).toMatchObject({ reorderLevel: 5, max: 12, suggested: 8 });
	});
});

describe('ordersFromReorder', () => {
	it('makes one draft per main supplier', async () => {
		const s1 = await makeSupplier();
		const s2 = await makeSupplier();
		const a = await makeProduct({ stockQty: 0, mainSupplierId: s1 });
		const b = await makeProduct({ stockQty: 0, mainSupplierId: s1 });
		const c = await makeProduct({ stockQty: 0, mainSupplierId: s2 });
		const ids = await ordersFromReorder(
			[
				{ productId: a, quantity: 5 },
				{ productId: b, quantity: 2 },
				{ productId: c, quantity: 9 }
			],
			actor
		);
		expect(ids).toHaveLength(2);
		const orders = await db.select().from(purchaseOrder);
		expect(orders.map((o) => [o.supplierId, o.status]).sort()).toEqual(
			[
				[s1, 'draft'],
				[s2, 'draft']
			].sort()
		);
	});

	it('says which products have no supplier', async () => {
		const p = await makeProduct({ stockQty: 0, name: 'Mystery box' });
		await expect(ordersFromReorder([{ productId: p, quantity: 3 }], actor)).rejects.toThrow(
			/main supplier first for: Mystery box/
		);
	});
});
