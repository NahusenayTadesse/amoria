import { and, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
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
import { orders } from '$lib/server/db/schema';
import { ORDER_STATUSES, FULFILMENTS } from '$lib/constants';
import { ORDER_STATUS_LABELS, type OrderStatus } from '$lib/orderStatus';

const FILTERS = ['status', 'fulfilment', 'queue'] as const;
const SORTS = { createdAt: orders.createdAt, total: orders.total };

/**
 * An order with a transfer receipt waiting for staff.
 *
 * The outer column is written out as `orders`.`id`, not interpolated: in a select without joins
 * Drizzle prints `${orders.id}` as a bare `id`, which inside the subquery means the *payment's* id
 * (stock management hit the same trap; see its `qualified`). That made every order whose id
 * happened to equal a pending payment's id show "Receipt to check".
 */
const receiptWaiting = sql<number>`EXISTS (SELECT 1 FROM payment p WHERE p.order_id = \`orders\`.\`id\` AND p.provider = 'bank_transfer' AND p.status = 'initiated')`;

/**
 * The orders someone has to do something about (§12.3: "Orders defaults to needs action"): paid and
 * not yet handed over, short of an item, or waiting on a receipt check.
 */
const needsAction = or(
	inArray(orders.status, ['paid', 'preparing', 'ready', 'paid_unfulfillable']),
	and(eq(orders.status, 'pending_payment'), sql`${receiptWaiting}`)
);

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const queue = query.filters.queue === 'all' ? 'all' : 'action';

	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		base: [queue === 'action' ? needsAction : undefined],
		search: (term) =>
			or(
				like(orders.ref, `%${term}%`),
				like(orders.contactName, `%${term}%`),
				like(orders.contactPhone, `%${term.replace(/^0/, '')}%`)
			),
		dateColumn: orders.createdAt,
		filters: {
			status: (v) =>
				(ORDER_STATUSES as readonly string[]).includes(v)
					? eq(orders.status, v as OrderStatus)
					: undefined,
			fulfilment: (v) =>
				(FULFILMENTS as readonly string[]).includes(v)
					? eq(orders.fulfilment, v as 'pickup' | 'delivery')
					: undefined
		}
	};
	const where = buildWhere(query, spec);

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: orders.id,
				ref: orders.ref,
				createdAt: orders.createdAt,
				contactName: orders.contactName,
				contactPhone: orders.contactPhone,
				fulfilment: orders.fulfilment,
				deliveryAreaName: orders.deliveryAreaName,
				total: orders.total,
				status: orders.status,
				receiptWaiting
			})
			.from(orders)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(orders.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(orders).where(where),
		facetCounts({
			status: () =>
				db
					.select({ value: orders.status, count: count() })
					.from(orders)
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(orders.status)
					.then((list) => list.map((f) => ({ ...f, label: ORDER_STATUS_LABELS[f.value] }))),
			fulfilment: () =>
				db
					.select({ value: orders.fulfilment, count: count() })
					.from(orders)
					.where(buildWhere(query, spec, { except: 'fulfilment' }))
					.groupBy(orders.fulfilment)
		})
	]);

	return {
		rows: rows.map((row) => ({ ...row, receiptWaiting: Boolean(Number(row.receiptWaiting)) })),
		queue,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
