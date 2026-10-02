/**
 * Stock reports: what the stock is worth, what moved, what sells, what does not, what was lost, and
 * the VAT. Every figure is read off the ledger and the documents, so each one can be traced back to
 * the movements that make it; nothing here writes.
 *
 * "Usage" is what left the business: sales, till sales, issues, damage, loss and expiry, net of
 * cancelled sales and customer returns. Moves between locations are not usage.
 */
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { addLocalDays, localToday } from '@nahu/admin-kit/time';
import { getEthiopianYearMonth } from '@nahu/admin-kit/global';
import { db } from '$lib/server/db';
import {
	category,
	location,
	orders,
	orderItem,
	product,
	purchaseOrder,
	purchaseOrderLine,
	stockBalance,
	stockDocument,
	stockDocumentLine,
	stockMovement,
	supplier
} from '$lib/server/db/schema';
import { roundBirr, sumBirr } from '$lib/money';
import { dayNoon, vatWithin } from '$lib/stockMath';
import { getSettings } from '../settings';
import { receivedByLine } from './purchasing';

const USAGE_REASONS = [
	'sale',
	'sale_cancel',
	'pos_sale',
	'customer_return',
	'issue',
	'damage',
	'loss',
	'expiry'
] as const;
const usageIn = sql.raw(USAGE_REASONS.map((r) => `'${r}'`).join(','));

export type Period = { from: string; to: string };

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The last `days` days up to today, inclusive. */
export function lastDays(days: number, today = localToday()): Period {
	return { from: addLocalDays(today, -(days - 1)), to: today };
}

// ── Stock value ─────────────────────────────────────────────────────────────────────────────

/** What is on hand, valued at each product's average cost, by product, category and location. */
export async function stockValue(options: { locationId?: number | null } = {}) {
	const rows = await db
		.select({
			productId: product.id,
			product: product.name,
			sku: product.sku,
			unit: product.unit,
			category: category.name,
			locationId: location.id,
			location: location.name,
			quantity: sql<number>`SUM(${stockBalance.quantity})`,
			avgCost: product.avgCost
		})
		.from(stockBalance)
		.innerJoin(product, eq(product.id, stockBalance.productId))
		.innerJoin(location, eq(location.id, stockBalance.locationId))
		.leftJoin(category, eq(category.id, product.categoryId))
		.where(
			and(
				sql`${stockBalance.quantity} > 0`,
				sql`${product.deletedAt} IS NULL`,
				options.locationId ? eq(stockBalance.locationId, options.locationId) : undefined
			)
		)
		.groupBy(
			product.id,
			product.name,
			product.sku,
			product.unit,
			category.name,
			location.id,
			location.name,
			product.avgCost
		);

	const lines = rows.map((r) => ({
		...r,
		quantity: Number(r.quantity),
		value: roundBirr(Number(r.quantity) * r.avgCost)
	}));
	const group = (key: (r: (typeof lines)[number]) => string) => {
		const map = new Map<string, { name: string; quantity: number; value: number }>();
		for (const r of lines) {
			const name = key(r);
			const g = map.get(name) ?? { name, quantity: 0, value: 0 };
			g.quantity += r.quantity;
			g.value = roundBirr(g.value + r.value);
			map.set(name, g);
		}
		return [...map.values()].sort((a, b) => b.value - a.value);
	};
	const byProduct = new Map<
		number,
		{ id: number; name: string; quantity: number; value: number }
	>();
	for (const r of lines) {
		const g = byProduct.get(r.productId) ?? {
			id: r.productId,
			name: r.product,
			quantity: 0,
			value: 0
		};
		g.quantity += r.quantity;
		g.value = roundBirr(g.value + r.value);
		byProduct.set(r.productId, g);
	}
	return {
		total: sumBirr(lines.map((l) => l.value)),
		byCategory: group((r) => r.category ?? 'No category'),
		byLocation: group((r) => r.location),
		byProduct: [...byProduct.values()].sort((a, b) => b.value - a.value)
	};
}

// ── Movement over time ──────────────────────────────────────────────────────────────────────

/**
 * Units in and out per day, and per Ethiopian month when the period is longer than two months.
 * Moves between locations are left out, they change nothing.
 */
export async function movementsOverTime(period: Period) {
	const rows = await db
		.select({
			day: stockMovement.docDate,
			inQty: sql<number>`SUM(CASE WHEN ${stockMovement.delta} > 0 THEN ${stockMovement.delta} ELSE 0 END)`,
			outQty: sql<number>`SUM(CASE WHEN ${stockMovement.delta} < 0 THEN -${stockMovement.delta} ELSE 0 END)`,
			inValue: sql<number>`SUM(CASE WHEN ${stockMovement.delta} > 0 THEN ${stockMovement.delta} * ${stockMovement.unitCost} ELSE 0 END)`,
			outValue: sql<number>`SUM(CASE WHEN ${stockMovement.delta} < 0 THEN -${stockMovement.delta} * ${stockMovement.unitCost} ELSE 0 END)`
		})
		.from(stockMovement)
		.where(
			and(
				gte(stockMovement.docDate, period.from),
				lte(stockMovement.docDate, period.to),
				sql`${stockMovement.reason} NOT IN ('transfer_in', 'transfer_out')`
			)
		)
		.groupBy(stockMovement.docDate)
		.orderBy(asc(stockMovement.docDate));

	const byMonth = daysBetween(period.from, period.to) > 62;
	const buckets = new Map<
		string,
		{ label: string; inQty: number; outQty: number; inValue: number; outValue: number }
	>();
	for (const r of rows) {
		let key = r.day;
		if (byMonth) {
			const ym = getEthiopianYearMonth(dayNoon(r.day));
			key = ym ? `${ym.year}-${String(ym.month).padStart(2, '0')}` : r.day.slice(0, 7);
		}
		const b = buckets.get(key) ?? { label: key, inQty: 0, outQty: 0, inValue: 0, outValue: 0 };
		b.inQty += Number(r.inQty);
		b.outQty += Number(r.outQty);
		b.inValue = roundBirr(b.inValue + Number(r.inValue));
		b.outValue = roundBirr(b.outValue + Number(r.outValue));
		buckets.set(key, b);
	}
	return { byMonth, points: [...buckets.values()] };
}

// ── Usage ───────────────────────────────────────────────────────────────────────────────────

/** The products with the most net usage in the period, and what that usage cost. */
export async function topUsed(period: Period, limit = 20) {
	const rows = await db
		.select({
			productId: product.id,
			product: product.name,
			unit: product.unit,
			used: sql<number>`SUM(-${stockMovement.delta})`,
			cost: sql<number>`SUM(-${stockMovement.delta} * ${stockMovement.unitCost})`
		})
		.from(stockMovement)
		.innerJoin(product, eq(product.id, stockMovement.productId))
		.where(
			and(
				gte(stockMovement.docDate, period.from),
				lte(stockMovement.docDate, period.to),
				sql`${stockMovement.reason} IN (${usageIn})`
			)
		)
		.groupBy(product.id, product.name, product.unit)
		.having(sql`SUM(-${stockMovement.delta}) > 0`)
		.orderBy(sql`SUM(-${stockMovement.delta}) DESC`)
		.limit(limit);
	return rows.map((r) => ({ ...r, used: Number(r.used), cost: roundBirr(Number(r.cost)) }));
}

/** What was written off, damaged, lost or expired, by reason, with what it cost. */
export async function writeOffs(period: Period) {
	const rows = await db
		.select({
			reason: stockMovement.reason,
			quantity: sql<number>`SUM(-${stockMovement.delta})`,
			cost: sql<number>`SUM(-${stockMovement.delta} * ${stockMovement.unitCost})`,
			lines: sql<number>`COUNT(*)`
		})
		.from(stockMovement)
		.where(
			and(
				gte(stockMovement.docDate, period.from),
				lte(stockMovement.docDate, period.to),
				sql`(${stockMovement.reason} IN ('damage', 'loss', 'expiry')
					OR (${stockMovement.reason} = 'adjustment' AND ${stockMovement.delta} < 0))`
			)
		)
		.groupBy(stockMovement.reason);
	return rows
		.map((r) => ({
			reason: r.reason,
			quantity: Number(r.quantity),
			cost: roundBirr(Number(r.cost)),
			lines: Number(r.lines)
		}))
		.sort((a, b) => b.cost - a.cost);
}

// ── Buying ──────────────────────────────────────────────────────────────────────────────────

/**
 * What each supplier was ordered from and delivered (fill rate), and what their deliveries cost
 * over the period, whether or not they were against an order.
 */
export async function purchasesBySupplier(period: Period) {
	const orderRows = await db
		.select({
			id: purchaseOrder.id,
			supplierId: purchaseOrder.supplierId,
			supplier: supplier.name
		})
		.from(purchaseOrder)
		.innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
		.where(
			and(
				gte(purchaseOrder.orderDate, period.from),
				lte(purchaseOrder.orderDate, period.to),
				inArray(purchaseOrder.status, ['ordered', 'partially_received', 'received', 'closed'])
			)
		);
	const result = new Map<
		number,
		{
			supplierId: number;
			supplier: string;
			orders: number;
			ordered: number;
			received: number;
			deliveredValue: number;
		}
	>();
	const entry = (supplierId: number, name: string) => {
		const e = result.get(supplierId) ?? {
			supplierId,
			supplier: name,
			orders: 0,
			ordered: 0,
			received: 0,
			deliveredValue: 0
		};
		result.set(supplierId, e);
		return e;
	};
	for (const o of orderRows) {
		const e = entry(o.supplierId, o.supplier);
		e.orders += 1;
		const lines = await db
			.select({ id: purchaseOrderLine.id, quantity: purchaseOrderLine.quantity })
			.from(purchaseOrderLine)
			.where(eq(purchaseOrderLine.purchaseOrderId, o.id));
		const got = await receivedByLine(db, o.id);
		for (const l of lines) {
			e.ordered += l.quantity;
			e.received += Math.min(l.quantity, got.get(l.id) ?? 0);
		}
	}

	const delivered = await db
		.select({
			supplierId: stockDocument.supplierId,
			supplier: supplier.name,
			value: sql<number>`SUM(${stockDocumentLine.quantity} * COALESCE(${stockDocumentLine.unitCost}, 0))`
		})
		.from(stockDocumentLine)
		.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
		.innerJoin(supplier, eq(supplier.id, stockDocument.supplierId))
		.where(
			and(
				eq(stockDocument.type, 'receipt'),
				eq(stockDocument.status, 'posted'),
				gte(stockDocument.docDate, period.from),
				lte(stockDocument.docDate, period.to)
			)
		)
		.groupBy(stockDocument.supplierId, supplier.name);
	for (const d of delivered) {
		entry(d.supplierId!, d.supplier).deliveredValue = roundBirr(Number(d.value));
	}
	return [...result.values()]
		.map((e) => ({ ...e, fillRate: e.ordered ? Math.round((e.received / e.ordered) * 100) : null }))
		.sort((a, b) => b.deliveredValue - a.deliveredValue);
}

// ── Slow movers, ABC, stock-outs, trend ─────────────────────────────────────────────────────

/** Products with stock that have not been used for `days` days or more, and what is tied up in them. */
export async function slowMoving(options: { days?: number; today?: string } = {}) {
	const days = options.days ?? 90;
	const today = options.today ?? localToday();
	const rows = await db
		.select({
			productId: product.id,
			product: product.name,
			sku: product.sku,
			unit: product.unit,
			onHand: sql<number>`SUM(${stockBalance.quantity})`,
			avgCost: product.avgCost,
			lastUsed: sql<
				string | null
			>`(SELECT MAX(m.doc_date) FROM stock_movement m WHERE m.product_id = ${product.id} AND m.reason IN (${usageIn}) AND m.delta < 0)`,
			firstSeen: sql<
				string | null
			>`(SELECT MIN(m.doc_date) FROM stock_movement m WHERE m.product_id = ${product.id})`
		})
		.from(stockBalance)
		.innerJoin(product, eq(product.id, stockBalance.productId))
		.where(sql`${stockBalance.quantity} > 0 AND ${product.deletedAt} IS NULL`)
		.groupBy(product.id, product.name, product.sku, product.unit, product.avgCost);

	return rows
		.map((r) => {
			const since = r.lastUsed ?? r.firstSeen ?? today;
			return {
				...r,
				onHand: Number(r.onHand),
				value: roundBirr(Number(r.onHand) * r.avgCost),
				daysIdle: Math.max(0, daysBetween(since, today)),
				neverUsed: r.lastUsed === null
			};
		})
		.filter((r) => r.daysIdle >= days)
		.sort((a, b) => b.value - a.value);
}

/**
 * ABC analysis: products ranked by what they account for, cumulatively. A covers the first 80%, B
 * the next 15%, C the rest. By `cost` (what was used, at cost) or by `revenue` (what was sold).
 */
export async function abcAnalysis(period: Period, by: 'cost' | 'revenue' = 'cost') {
	let figures: { productId: number; name: string; amount: number }[];
	if (by === 'cost') {
		figures = (await topUsed(period, 10_000)).map((r) => ({
			productId: r.productId,
			name: r.product,
			amount: r.cost
		}));
	} else {
		const till = await db
			.select({
				productId: product.id,
				name: product.name,
				amount: sql<number>`SUM(${stockDocumentLine.quantity} * ${stockDocumentLine.unitPrice})`
			})
			.from(stockDocumentLine)
			.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
			.innerJoin(product, eq(product.id, stockDocumentLine.productId))
			.where(
				and(
					eq(stockDocument.type, 'issue'),
					eq(stockDocument.status, 'posted'),
					sql`${stockDocument.shiftId} IS NOT NULL`,
					gte(stockDocument.docDate, period.from),
					lte(stockDocument.docDate, period.to)
				)
			)
			.groupBy(product.id, product.name);
		const online = await db
			.select({
				productId: product.id,
				name: product.name,
				amount: sql<number>`SUM(${orderItem.lineTotal})`
			})
			.from(orderItem)
			.innerJoin(orders, eq(orders.id, orderItem.orderId))
			.innerJoin(product, eq(product.id, orderItem.productId))
			.where(and(paidOrder, paidWithin(period)))
			.groupBy(product.id, product.name);
		const merged = new Map<number, { productId: number; name: string; amount: number }>();
		for (const r of [...till, ...online]) {
			const e = merged.get(r.productId) ?? { productId: r.productId, name: r.name, amount: 0 };
			e.amount = roundBirr(e.amount + Number(r.amount));
			merged.set(r.productId, e);
		}
		figures = [...merged.values()];
	}
	figures = figures.filter((f) => f.amount > 0).sort((a, b) => b.amount - a.amount);
	const total = sumBirr(figures.map((f) => f.amount));
	let running = 0;
	return figures.map((f) => {
		running += f.amount;
		const before = (running - f.amount) / total;
		return {
			...f,
			share: total ? Math.round((f.amount / total) * 1000) / 10 : 0,
			cumulative: total ? Math.round((running / total) * 1000) / 10 : 0,
			class: (before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C') as 'A' | 'B' | 'C'
		};
	});
}

/** A product's stock level at the end of each day it moved, from the ledger, over a period. */
export async function stockTrend(productId: number, period: Period) {
	const rows = await db
		.select({
			day: stockMovement.docDate,
			delta: stockMovement.delta,
			reason: stockMovement.reason
		})
		.from(stockMovement)
		.where(and(eq(stockMovement.productId, productId), lte(stockMovement.docDate, period.to)))
		.orderBy(asc(stockMovement.id));
	// Moves between locations and into quarantine change where stock is, not how much there is.
	const level = new Map<string, number>();
	let running = 0;
	let opening = 0;
	for (const r of rows) {
		if (r.reason === 'transfer_in' || r.reason === 'transfer_out') continue;
		running += r.delta;
		if (r.day < period.from) opening = running;
		else level.set(r.day, running);
	}
	const [{ threshold }] = await db
		.select({ threshold: product.lowStockThreshold })
		.from(product)
		.where(eq(product.id, productId));
	return {
		opening,
		reorderLevel: threshold,
		points: [...level.entries()].map(([day, quantity]) => ({ day, quantity }))
	};
}

/**
 * When each product ran out and for how long, from the ledger: a stock-out starts when the total
 * on hand reaches zero after being above it, and ends when stock comes back. Products that were
 * never stocked are not stock-outs.
 */
export async function stockOuts(period: Period, today = localToday()) {
	const rows = await db
		.select({
			productId: stockMovement.productId,
			name: product.name,
			day: stockMovement.docDate,
			delta: stockMovement.delta,
			reason: stockMovement.reason
		})
		.from(stockMovement)
		.innerJoin(product, eq(product.id, stockMovement.productId))
		.where(lte(stockMovement.docDate, period.to))
		.orderBy(asc(stockMovement.productId), asc(stockMovement.id));

	const outs: { productId: number; name: string; from: string; to: string | null; days: number }[] =
		[];
	let current: number | null = null;
	let running = 0;
	let open: { from: string } | null = null;
	const close = (name: string, productId: number, endDay: string | null) => {
		if (!open) return;
		const end = endDay ?? (period.to < today ? period.to : today);
		if (end >= period.from) {
			outs.push({
				productId,
				name,
				from: open.from < period.from ? period.from : open.from,
				to: endDay,
				days: Math.max(0, daysBetween(open.from < period.from ? period.from : open.from, end))
			});
		}
		open = null;
	};
	let lastName = '';
	for (const r of rows) {
		if (r.productId !== current) {
			if (current !== null) close(lastName, current, null);
			current = r.productId;
			running = 0;
			open = null;
		}
		lastName = r.name;
		if (r.reason === 'transfer_in' || r.reason === 'transfer_out') continue;
		const before = running;
		running += r.delta;
		if (before > 0 && running <= 0) open = { from: r.day };
		else if (before <= 0 && running > 0) close(r.name, r.productId, r.day);
	}
	if (current !== null) close(lastName, current, null);
	return outs.sort((a, b) => b.days - a.days);
}

// ── Sales and VAT ───────────────────────────────────────────────────────────────────────────

const PAID = ['paid', 'preparing', 'ready', 'completed'] as const;
const paidOrder = inArray(orders.status, [...PAID]);
/** Orders paid within the period, by the Addis Ababa day of payment. */
const paidWithin = (p: Period) =>
	sql`DATE(DATE_ADD(${orders.paidAt}, INTERVAL 3 HOUR)) BETWEEN ${p.from} AND ${p.to}`;

/** Online and till sales for the period: how many, and what they brought in. */
export async function salesSummary(period: Period) {
	const [online] = await db
		.select({ count: sql<number>`COUNT(*)`, total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
		.from(orders)
		.where(and(paidOrder, paidWithin(period)));
	const [till] = await db
		.select({
			count: sql<number>`COUNT(*)`,
			total: sql<number>`COALESCE(SUM(${stockDocument.total}), 0)`
		})
		.from(stockDocument)
		.where(
			and(
				eq(stockDocument.type, 'issue'),
				eq(stockDocument.status, 'posted'),
				sql`${stockDocument.shiftId} IS NOT NULL`,
				gte(stockDocument.docDate, period.from),
				lte(stockDocument.docDate, period.to)
			)
		);
	const [refunds] = await db
		.select({ total: sql<number>`COALESCE(SUM(${stockDocument.total}), 0)` })
		.from(stockDocument)
		.where(
			and(
				eq(stockDocument.type, 'sales_return'),
				eq(stockDocument.status, 'posted'),
				gte(stockDocument.docDate, period.from),
				lte(stockDocument.docDate, period.to)
			)
		);
	const onlineTotal = roundBirr(Number(online.total));
	const tillTotal = roundBirr(Number(till.total));
	const refunded = roundBirr(Number(refunds.total));
	return {
		online: { count: Number(online.count), total: onlineTotal },
		till: { count: Number(till.count), total: tillTotal, refunded },
		net: roundBirr(onlineTotal + tillTotal - refunded)
	};
}

/**
 * VAT for the period, for filing: output VAT on till sales less refunds (fixed when each was
 * posted), input VAT on deliveries from VAT-registered suppliers, and the registers behind both.
 * Online sales carry VAT too, but their orders keep no tax snapshot, so that part is an estimate
 * from each product's tax code today (`onlineVatEstimate`), shown apart.
 */
export async function vatReport(period: Period) {
	const settings = await getSettings();

	const salesRegister = await db
		.select({
			id: stockDocument.id,
			number: stockDocument.number,
			type: stockDocument.type,
			day: stockDocument.docDate,
			subtotal: stockDocument.subtotal,
			vatTotal: stockDocument.vatTotal,
			total: stockDocument.total
		})
		.from(stockDocument)
		.where(
			and(
				inArray(stockDocument.type, ['issue', 'sales_return']),
				eq(stockDocument.status, 'posted'),
				sql`${stockDocument.shiftId} IS NOT NULL`,
				gte(stockDocument.docDate, period.from),
				lte(stockDocument.docDate, period.to)
			)
		)
		.orderBy(asc(stockDocument.docDate), asc(stockDocument.id));
	const sign = (type: string) => (type === 'sales_return' ? -1 : 1);
	const outputVat = sumBirr(salesRegister.map((r) => sign(r.type) * (r.vatTotal ?? 0)));
	const salesNet = sumBirr(salesRegister.map((r) => sign(r.type) * (r.subtotal ?? 0)));

	const purchasesRegister = await db
		.select({
			id: stockDocument.id,
			number: stockDocument.number,
			day: stockDocument.docDate,
			supplier: supplier.name,
			tin: supplier.tin,
			net: sql<number>`SUM(${stockDocumentLine.quantity} * COALESCE(${stockDocumentLine.unitCost}, 0))`,
			vat: sql<number>`SUM(${stockDocumentLine.quantity} * COALESCE(${stockDocumentLine.unitCost}, 0) * COALESCE(${stockDocumentLine.vatRate}, 0) / 100)`
		})
		.from(stockDocumentLine)
		.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
		.innerJoin(supplier, eq(supplier.id, stockDocument.supplierId))
		.where(
			and(
				eq(stockDocument.type, 'receipt'),
				eq(stockDocument.status, 'posted'),
				gte(stockDocument.docDate, period.from),
				lte(stockDocument.docDate, period.to)
			)
		)
		.groupBy(
			stockDocument.id,
			stockDocument.number,
			stockDocument.docDate,
			supplier.name,
			supplier.tin
		)
		.orderBy(asc(stockDocument.docDate), asc(stockDocument.id));
	const purchases = purchasesRegister.map((r) => ({
		...r,
		net: roundBirr(Number(r.net)),
		vat: roundBirr(Number(r.vat))
	}));
	const inputVat = sumBirr(purchases.map((p) => p.vat));

	// Online sales: VAT-inclusive prices, standard-rated products only.
	let onlineVatEstimate = 0;
	if (settings.vatRegistered) {
		const items = await db
			.select({ lineTotal: orderItem.lineTotal })
			.from(orderItem)
			.innerJoin(orders, eq(orders.id, orderItem.orderId))
			.innerJoin(product, eq(product.id, orderItem.productId))
			.where(and(paidOrder, paidWithin(period), eq(product.taxCode, 'standard')));
		onlineVatEstimate = sumBirr(
			items.map((i) =>
				settings.pricesIncludeVat
					? roundBirr(vatWithin(i.lineTotal, settings.vatRate))
					: roundBirr((i.lineTotal * settings.vatRate) / 100)
			)
		);
	}
	return {
		registered: settings.vatRegistered,
		rate: settings.vatRate,
		outputVat,
		inputVat,
		payable: roundBirr(outputVat - inputVat),
		onlineVatEstimate,
		salesNet,
		salesRegister,
		purchasesRegister: purchases
	};
}
