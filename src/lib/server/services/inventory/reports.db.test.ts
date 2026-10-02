import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import {
	customer,
	orderItem,
	orders,
	purchaseOrder,
	purchaseOrderLine
} from '$lib/server/db/schema';
import {
	actorFor,
	dayFromNow,
	makeLocation,
	makeProduct,
	makeStaff,
	makeSupplier,
	resetDb,
	setSettings
} from '$lib/server/testing/db';
import { defaultPlace, move, places } from './ledger';
import { postDocument } from './post';
import { saveDocument, type DocLineInput } from './documents';
import { checkout, openShift } from './pos';
import {
	abcAnalysis,
	lastDays,
	movementsOverTime,
	purchasesBySupplier,
	salesSummary,
	slowMoving,
	stockOuts,
	stockTrend,
	stockValue,
	topUsed,
	vatReport,
	writeOffs
} from './reports';

beforeEach(resetDb);

const actor = actorFor(null);
const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;
const run = <T>(fn: Parameters<typeof db.transaction<T>>[0]) => db.transaction(fn);
const period = lastDays(30);
const at = (days: number) => dayFromNow(days);

let seq = 0;
/** A paid (or, told otherwise, unpaid) online order, made directly. */
async function onlineOrder(
	total: number,
	options: {
		status?: 'paid' | 'completed' | 'pending_payment';
		productId?: number;
		qty?: number;
	} = {}
) {
	seq += 1;
	const [c] = await db
		.insert(customer)
		.values({ name: `Buyer ${seq}`, phone: `+2519110000${String(seq).padStart(2, '0')}` })
		.$returningId();
	const status = options.status ?? 'paid';
	const [o] = await db
		.insert(orders)
		.values({
			publicToken: `tok-report-${seq}`,
			customerId: c.id,
			contactName: `Buyer ${seq}`,
			contactPhone: `+2519110000${String(seq).padStart(2, '0')}`,
			fulfilment: 'pickup',
			subtotal: total,
			deliveryFee: 0,
			total,
			status,
			paidAt: status === 'pending_payment' ? null : new Date()
		})
		.$returningId();
	if (options.productId) {
		await db.insert(orderItem).values({
			orderId: o.id,
			productId: options.productId,
			nameSnapshot: 'item',
			unitPrice: total / (options.qty ?? 1),
			qty: options.qty ?? 1,
			lineTotal: total
		});
	}
	return o.id;
}

describe('stockValue', () => {
	it('values stock at average cost, by product, category and location', async () => {
		const shop = await shopFloor();
		const store = await makeLocation();
		const a = await makeProduct({ stockQty: 10, avgCost: 20, name: 'A' });
		await makeProduct({ stockQty: 4, avgCost: 50, name: 'B' });
		await run((tx) => move(tx, { productId: a, delta: 5, reason: 'delivery', locationId: store }));

		const v = await stockValue();
		expect(v.total).toBe(10 * 20 + 5 * 20 + 4 * 50);
		expect(v.byProduct.map((p) => [p.name, p.quantity, p.value])).toEqual([
			['A', 15, 300],
			['B', 4, 200]
		]);
		expect(v.byLocation.map((l) => l.value).sort((x, y) => x - y)).toEqual([100, 400]);
		expect((await stockValue({ locationId: shop })).total).toBe(400);
	});
});

describe('usage', () => {
	it('counts sales and issues as usage, net of cancellations, and ignores transfers', async () => {
		const shop = await shopFloor();
		const store = await makeLocation();
		const p = await makeProduct({ stockQty: 20, avgCost: 10, name: 'Ribbon' });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: -6, reason: 'sale', refType: 'order', refId: 1 });
			await move(tx, { productId: p, delta: 2, reason: 'sale_cancel', refType: 'order', refId: 1 });
			await move(tx, { productId: p, delta: -3, reason: 'issue', locationId: shop });
			await move(tx, { productId: p, delta: -4, reason: 'transfer_out', locationId: shop });
			await move(tx, { productId: p, delta: 4, reason: 'transfer_in', locationId: store });
		});
		const [row] = await topUsed(period);
		expect(row).toMatchObject({ product: 'Ribbon', used: 7, cost: 70 });

		const flow = await movementsOverTime(period);
		expect(flow.byMonth).toBe(false);
		expect(flow.points).toHaveLength(1);
		expect(flow.points[0]).toMatchObject({ inQty: 2, outQty: 9, outValue: 90 });
	});

	it('groups a long period by Ethiopian month', async () => {
		const p = await makeProduct({ stockQty: 20 });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: -1, reason: 'sale', docDate: at(-100) });
			await move(tx, { productId: p, delta: -1, reason: 'sale', docDate: at(-1) });
		});
		const flow = await movementsOverTime(lastDays(120));
		expect(flow.byMonth).toBe(true);
		expect(flow.points.length).toBeGreaterThanOrEqual(2);
		expect(flow.points[0].label).toMatch(/^\d{4}-\d{2}$/);
	});

	it('reports write-offs by reason with their cost', async () => {
		const shop = await shopFloor();
		const p = await makeProduct({ stockQty: 30, avgCost: 5 });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: -2, reason: 'damage', locationId: shop });
			await move(tx, { productId: p, delta: -3, reason: 'expiry', locationId: shop });
			await move(tx, { productId: p, delta: -1, reason: 'adjustment', locationId: shop });
			await move(tx, { productId: p, delta: 4, reason: 'adjustment', locationId: shop });
		});
		const rows = await writeOffs(period);
		expect(Object.fromEntries(rows.map((r) => [r.reason, [r.quantity, r.cost]]))).toEqual({
			damage: [2, 10],
			expiry: [3, 15],
			adjustment: [1, 5]
		});
	});
});

describe('slowMoving and abc', () => {
	it('lists stock that has not moved for the threshold, most valuable first', async () => {
		const stale = await makeProduct({ stockQty: 0, avgCost: 100, name: 'Stale' });
		const fresh = await makeProduct({ stockQty: 0, avgCost: 100, name: 'Fresh' });
		await run(async (tx) => {
			await move(tx, { productId: stale, delta: 5, reason: 'delivery', docDate: at(-200) });
			await move(tx, { productId: stale, delta: -1, reason: 'sale', docDate: at(-150) });
			await move(tx, { productId: fresh, delta: 5, reason: 'delivery', docDate: at(-200) });
			await move(tx, { productId: fresh, delta: -1, reason: 'sale', docDate: at(-3) });
		});
		const rows = await slowMoving({ days: 90 });
		expect(rows.map((r) => [r.product, r.daysIdle, r.value])).toEqual([['Stale', 150, 400]]);
	});

	it('ranks products by cost used and classes them A, B and C', async () => {
		const big = await makeProduct({ stockQty: 100, avgCost: 100, name: 'Big' });
		const mid = await makeProduct({ stockQty: 100, avgCost: 100, name: 'Mid' });
		const small = await makeProduct({ stockQty: 100, avgCost: 100, name: 'Small' });
		await run(async (tx) => {
			await move(tx, { productId: big, delta: -80, reason: 'sale' });
			await move(tx, { productId: mid, delta: -15, reason: 'sale' });
			await move(tx, { productId: small, delta: -5, reason: 'sale' });
		});
		const rows = await abcAnalysis(period, 'cost');
		expect(rows.map((r) => [r.name, r.class, r.cumulative])).toEqual([
			['Big', 'A', 80],
			['Mid', 'B', 95],
			['Small', 'C', 100]
		]);
	});

	it('ranks by revenue across till and online sales', async () => {
		const staff = await makeStaff();
		await openShift({ floatAmount: 0 }, actorFor(staff));
		const a = await makeProduct({ stockQty: 10, price: 100, name: 'A' });
		const b = await makeProduct({ stockQty: 10, price: 100, name: 'B' });
		await checkout(
			{ lines: [{ productId: a, quantity: 2 }], payments: [{ method: 'cash', amount: 200 }] },
			actorFor(staff)
		);
		await onlineOrder(500, { productId: b, qty: 5 });
		const rows = await abcAnalysis(period, 'revenue');
		expect(rows.map((r) => [r.name, r.amount])).toEqual([
			['B', 500],
			['A', 200]
		]);
	});
});

describe('stock-outs and trend', () => {
	it('finds when a product ran out and for how long', async () => {
		const p = await makeProduct({ stockQty: 0, name: 'Candle' });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: 5, reason: 'delivery', docDate: at(-20) });
			await move(tx, { productId: p, delta: -5, reason: 'sale', docDate: at(-10) });
			await move(tx, { productId: p, delta: 8, reason: 'delivery', docDate: at(-4) });
		});
		const outs = await stockOuts(period);
		expect(outs).toEqual([{ productId: p, name: 'Candle', from: at(-10), to: at(-4), days: 6 }]);
	});

	it('shows a product still out as an open stock-out', async () => {
		const p = await makeProduct({ stockQty: 0, name: 'Vase' });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: 2, reason: 'delivery', docDate: at(-9) });
			await move(tx, { productId: p, delta: -2, reason: 'sale', docDate: at(-5) });
		});
		const [out] = await stockOuts(period);
		expect(out).toMatchObject({ name: 'Vase', from: at(-5), to: null, days: 5 });
	});

	it('traces a product level day by day, skipping moves between locations', async () => {
		const shop = await shopFloor();
		const store = await makeLocation();
		const p = await makeProduct({ stockQty: 0 });
		await run(async (tx) => {
			await move(tx, { productId: p, delta: 10, reason: 'delivery', docDate: at(-40) });
			await move(tx, { productId: p, delta: -3, reason: 'sale', docDate: at(-5) });
			await move(tx, {
				productId: p,
				delta: -2,
				reason: 'transfer_out',
				locationId: shop,
				docDate: at(-4)
			});
			await move(tx, {
				productId: p,
				delta: 2,
				reason: 'transfer_in',
				locationId: store,
				docDate: at(-4)
			});
			await move(tx, { productId: p, delta: -1, reason: 'sale', docDate: at(-2) });
		});
		const trend = await stockTrend(p, period);
		expect(trend.opening).toBe(10);
		expect(trend.points).toEqual([
			{ day: at(-5), quantity: 7 },
			{ day: at(-2), quantity: 6 }
		]);
	});
});

describe('purchasesBySupplier', () => {
	it('shows ordered against delivered, and what deliveries cost', async () => {
		const shop = await shopFloor();
		const s = await makeSupplier({ name: 'Wholesale Ltd' });
		const p = await makeProduct({ stockQty: 0 });
		const [{ id: poId }] = await db
			.insert(purchaseOrder)
			.values({ supplierId: s, orderDate: at(-3), locationId: shop, status: 'ordered' })
			.$returningId();
		const [{ id: lineId }] = await db
			.insert(purchaseOrderLine)
			.values({ purchaseOrderId: poId, productId: p, quantity: 10, unitCost: 40 })
			.$returningId();
		const lines: DocLineInput[] = [
			{ productId: p, quantity: 6, unitCost: 40, purchaseOrderLineId: lineId }
		];
		const receipt = await saveDocument(
			{
				header: {
					type: 'receipt',
					docDate: at(-1),
					toLocationId: shop,
					supplierId: s,
					purchaseOrderId: poId
				},
				lines
			},
			actor
		);
		await postDocument(receipt, actor);

		const [row] = await purchasesBySupplier(period);
		expect(row).toMatchObject({
			supplier: 'Wholesale Ltd',
			orders: 1,
			ordered: 10,
			received: 6,
			fillRate: 60,
			deliveredValue: 240
		});
	});
});

describe('sales and VAT', () => {
	it('sums online and till sales, less refunds', async () => {
		const staff = await makeStaff();
		await openShift({ floatAmount: 0 }, actorFor(staff));
		const p = await makeProduct({ stockQty: 5, price: 100 });
		await checkout(
			{ lines: [{ productId: p, quantity: 3 }], payments: [{ method: 'cash', amount: 300 }] },
			actorFor(staff)
		);
		await onlineOrder(250, { status: 'completed' });
		// Unpaid orders do not count.
		await onlineOrder(999, { status: 'pending_payment' });
		const s = await salesSummary(period);
		expect(s.online).toEqual({ count: 1, total: 250 });
		expect(s.till).toEqual({ count: 1, total: 300, refunded: 0 });
		expect(s.net).toBe(550);
	});

	it('reports output VAT on till sales and input VAT on deliveries from registered suppliers', async () => {
		await setSettings({ vatRegistered: true, vatRate: 15, pricesIncludeVat: true });
		const staff = await makeStaff();
		await openShift({ floatAmount: 0 }, actorFor(staff));
		const shop = await shopFloor();
		const registered = await makeSupplier({ name: 'Reg', vatRegistered: true, tin: '0012345678' });
		const unregistered = await makeSupplier({ name: 'Unreg' });
		const p = await makeProduct({ stockQty: 0, price: 115 });
		for (const [supplierId, cost] of [
			[registered, 100],
			[unregistered, 100]
		] as const) {
			const id = await saveDocument(
				{
					header: { type: 'receipt', docDate: at(0), toLocationId: shop, supplierId },
					lines: [{ productId: p, quantity: 4, unitCost: cost }]
				},
				actor
			);
			await postDocument(id, actor);
		}
		await checkout(
			{ lines: [{ productId: p, quantity: 2 }], payments: [{ method: 'cash', amount: 230 }] },
			actorFor(staff)
		);

		const v = await vatReport(period);
		expect(v.registered).toBe(true);
		expect(v.outputVat).toBe(30);
		expect(v.salesNet).toBe(200);
		// Only the registered supplier's 4 × 100 carries 15% input VAT.
		expect(v.inputVat).toBe(60);
		expect(v.payable).toBe(-30);
		expect(v.purchasesRegister.map((r) => [r.supplier, r.net, r.vat, r.tin])).toEqual(
			expect.arrayContaining([
				['Reg', 400, 60, '0012345678'],
				['Unreg', 400, 0, null]
			])
		);
		expect(v.salesRegister).toHaveLength(1);
	});
});
