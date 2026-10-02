import { count, desc, eq, like, or, sql } from 'drizzle-orm';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { db } from '$lib/server/db';
import { location, purchaseOrder, supplier } from '$lib/server/db/schema';
import { PO_STATUSES } from '$lib/constants';
import { badge } from '$lib/stock';

const FILTERS = ['status'] as const;
const SORTS = { orderDate: purchaseOrder.orderDate, number: purchaseOrder.number };

/** Purchase orders to suppliers, newest first. Drafts and part-received ones are easy to filter to. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 25, Object.keys(SORTS));
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(
				like(purchaseOrder.number, `%${term}%`),
				like(purchaseOrder.reference, `%${term}%`),
				like(supplier.name, `%${term}%`)
			),
		dateColumn: purchaseOrder.orderDate,
		filters: {
			status: (v) =>
				(PO_STATUSES as readonly string[]).includes(v)
					? eq(purchaseOrder.status, v as (typeof PO_STATUSES)[number])
					: undefined
		}
	};
	const where = buildWhere(query, spec);

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: purchaseOrder.id,
				number: purchaseOrder.number,
				status: purchaseOrder.status,
				orderDate: purchaseOrder.orderDate,
				expectedDate: purchaseOrder.expectedDate,
				supplier: supplier.name,
				location: location.name,
				lines: sql<number>`(SELECT COUNT(*) FROM purchase_order_line l WHERE l.purchase_order_id = \`purchase_order\`.\`id\` AND l.deleted_at IS NULL)`,
				value: sql<number>`(SELECT COALESCE(SUM(l.quantity * COALESCE(l.unit_cost, 0)), 0) FROM purchase_order_line l WHERE l.purchase_order_id = \`purchase_order\`.\`id\` AND l.deleted_at IS NULL)`
			})
			.from(purchaseOrder)
			.innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
			.innerJoin(location, eq(location.id, purchaseOrder.locationId))
			.where(where)
			.orderBy(
				...(orderBy(query, SORTS) ?? [desc(purchaseOrder.orderDate), desc(purchaseOrder.id)])
			)
			.limit(query.limit)
			.offset(query.offset),
		db
			.select({ total: count() })
			.from(purchaseOrder)
			.innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
			.where(where),
		facetCounts({
			statusLabel: () =>
				db
					.select({ value: purchaseOrder.status, count: count() })
					.from(purchaseOrder)
					.innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(purchaseOrder.status)
					.then((list) => list.map((f) => ({ ...f, label: badge(f.value).label })))
		})
	]);

	return {
		rows: rows.map((r) => ({
			...r,
			lines: Number(r.lines),
			value: Number(r.value),
			statusLabel: badge(r.status).label
		})),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
