import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm';
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
import { renter, renterOrder } from '$lib/server/db/schema';
import { RENTER_ORDER_STATUSES } from '$lib/constants';
import { RENTER_ORDER_LABELS, type RenterOrderStatus } from '$lib/rentalMarket';

const FILTERS = ['status', 'origin'] as const;
const SORTS = {
	createdAt: renterOrder.createdAt,
	startDate: renterOrder.startDate,
	total: renterOrder.total
};

/**
 * A server-mode table of marketplace orders (§5.12): one renter's (their dashboard), or every
 * renter's (staff's oversight). `only` narrows it to some statuses, as the requests page does.
 */
export async function renterOrderTable(
	url: URL,
	scope: { renterId?: number; only?: readonly RenterOrderStatus[] }
) {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(
				like(renterOrder.contactName, `%${term}%`),
				like(renterOrder.contactPhone, `%${term.replace(/^0/, '')}%`),
				like(renterOrder.ref, `%${term}%`),
				like(renterOrder.titleSnapshot, `%${term}%`)
			),
		dateColumn: renterOrder.createdAt,
		filters: {
			status: (v) =>
				(RENTER_ORDER_STATUSES as readonly string[]).includes(v)
					? eq(renterOrder.status, v as RenterOrderStatus)
					: undefined,
			origin: (v) => (v === 'buy_now' || v === 'quote' ? eq(renterOrder.origin, v) : undefined)
		}
	};
	const base = and(
		scope.renterId ? eq(renterOrder.renterId, scope.renterId) : undefined,
		scope.only ? inArray(renterOrder.status, [...scope.only]) : undefined
	);
	const where = and(base, buildWhere(query, spec));

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: renterOrder.id,
				ref: renterOrder.ref,
				createdAt: renterOrder.createdAt,
				title: renterOrder.titleSnapshot,
				renterName: renter.businessName,
				contactName: renterOrder.contactName,
				contactPhone: renterOrder.contactPhone,
				startDate: renterOrder.startDate,
				endDate: renterOrder.endDate,
				qty: renterOrder.qty,
				origin: renterOrder.origin,
				total: renterOrder.total,
				status: renterOrder.status
			})
			.from(renterOrder)
			.innerJoin(renter, eq(renter.id, renterOrder.renterId))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(renterOrder.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(renterOrder).where(where),
		facetCounts({
			status: () =>
				db
					.select({ value: renterOrder.status, count: count() })
					.from(renterOrder)
					.where(and(base, buildWhere(query, spec, { except: 'status' })))
					.groupBy(renterOrder.status)
					.then((list) => list.map((f) => ({ ...f, label: RENTER_ORDER_LABELS[f.value] }))),
			origin: () =>
				db
					.select({ value: renterOrder.origin, count: count() })
					.from(renterOrder)
					.where(and(base, buildWhere(query, spec, { except: 'origin' })))
					.groupBy(renterOrder.origin)
					.then((list) =>
						list.map((f) => ({ ...f, label: f.value === 'quote' ? 'Quote' : 'Book now' }))
					)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
}
