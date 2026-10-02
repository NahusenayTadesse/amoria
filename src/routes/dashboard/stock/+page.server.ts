import { and, asc, count, eq, like, sql, type SQL } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { category, product } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/services/settings';
import { adjustStock } from '$lib/server/services/stock';
import { locationOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { stockAdjustSchema } from '$lib/schemas/dashboard';
import { PRODUCT_KIND_LABELS, type StockReason } from '$lib/stock';
import { PRODUCT_KINDS } from '$lib/constants';

const FILTERS = ['kind', 'level', 'categoryId'] as const;
const SORTS = { name: product.name, stockQty: product.stockQty };

/** Units already taken for orders not paid yet (they come back if the hold runs out). */
// `product`.`id` written out, not interpolated: see the note on `receiptWaiting` in the orders list.
const held = sql<string>`(SELECT COALESCE(SUM(oi.qty), 0) FROM order_item oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = \`product\`.\`id\` AND o.status = 'pending_payment')`;

/**
 * Stock for every product the site keeps (§5.2) — gifts, rental equipment, and any kind added
 * later — in one list, because it is one ledger. "Low" is at or under the product's own threshold,
 * else the shop default; "out" is nothing left.
 */
export const load = async ({ url, locals }) => {
	const { lowStockDefault } = await getSettings();
	const threshold = sql`COALESCE(${product.lowStockThreshold}, ${lowStockDefault})`;
	const levelOf = sql<string>`CASE WHEN ${product.stockQty} <= 0 THEN 'out' WHEN ${product.stockQty} <= ${threshold} THEN 'low' ELSE 'ok' END`;
	const LEVELS: Record<string, SQL> = {
		out: sql`${product.stockQty} <= 0`,
		low: sql`${product.stockQty} > 0 AND ${product.stockQty} <= ${threshold}`,
		ok: sql`${product.stockQty} > ${threshold}`
	};

	const query = parseTableQuery(url, FILTERS, 50, Object.keys(SORTS));
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		base: [notDeleted(product)],
		search: (term) => like(product.name, `%${term}%`),
		filters: {
			kind: (v) =>
				(PRODUCT_KINDS as readonly string[]).includes(v)
					? eq(product.kind, v as 'gift' | 'rental')
					: undefined,
			level: (v) => LEVELS[v],
			categoryId: (v) => eq(product.categoryId, Number(v))
		}
	};
	const where = buildWhere(query, spec);

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: product.id,
				name: product.name,
				kind: product.kind,
				unit: product.unit,
				category: category.name,
				stockQty: product.stockQty,
				worth: sql<number>`ROUND(${product.stockQty} * ${product.avgCost}, 2)`,
				threshold: sql<number>`${threshold}`,
				level: levelOf,
				held,
				isActive: product.isActive
			})
			.from(product)
			.leftJoin(category, eq(category.id, product.categoryId))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [asc(product.stockQty), asc(product.name)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(product).where(where),
		// Keyed by column id (`kindLabel`, `category`); the page maps each to its URL param.
		facetCounts({
			kindLabel: () =>
				db
					.select({ value: product.kind, count: count() })
					.from(product)
					.where(buildWhere(query, spec, { except: 'kind' }))
					.groupBy(product.kind)
					.then((list) => list.map((f) => ({ ...f, label: PRODUCT_KIND_LABELS[f.value] }))),
			level: () =>
				db
					.select({ value: levelOf, count: count() })
					.from(product)
					.where(buildWhere(query, spec, { except: 'level' }))
					.groupBy(levelOf)
					.then((list) =>
						list.map((f) => ({
							...f,
							label: { out: 'Out of stock', low: 'Low', ok: 'OK' }[f.value] ?? f.value
						}))
					),
			category: () =>
				db
					.select({ value: category.id, label: category.name, count: count() })
					.from(product)
					.innerJoin(category, and(eq(category.id, product.categoryId), notDeleted(category)))
					.where(buildWhere(query, spec, { except: 'categoryId' }))
					.groupBy(category.id, category.name)
		})
	]);

	return {
		rows: rows.map((row) => ({
			...row,
			held: Number(row.held),
			worth: Number(row.worth),
			threshold: Number(row.threshold),
			kindLabel: PRODUCT_KIND_LABELS[row.kind]
		})),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canAdjust: hasPermission(locals, 'stock.adjust'),
		locations: await locationOptions({ withQuarantine: true }),
		adjustForm: await superValidate(zod4(stockAdjustSchema))
	};
};

export const actions = {
	adjust: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const form = await superValidate(event.request, zod4(stockAdjustSchema));
		if (!form.valid || !form.data.productId) {
			return message(form, { type: 'error', text: 'Check the quantity.' }, { status: 400 });
		}
		const { productId, locationId, mode, reason, qty, counted, note } = form.data;
		try {
			await adjustStock(
				productId,
				mode === 'count'
					? { mode, counted, note: note || null, locationId }
					: { mode, reason: reason as StockReason, qty, note: note || null, locationId },
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused)
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			throw err;
		}
		return message(form, { type: 'success', text: 'Stock updated' });
	}
};
