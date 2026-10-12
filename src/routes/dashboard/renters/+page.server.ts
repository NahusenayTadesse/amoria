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
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { renter, renterListing, user } from '$lib/server/db/schema';
import { RENTER_STATUSES } from '$lib/constants';
import { RENTER_STATUS_LABELS, type RenterStatus } from '$lib/rentalMarket';

const FILTERS = ['status'] as const;
const SORTS = { createdAt: renter.createdAt, businessName: renter.businessName };

/** Every renter who signed up, newest first; "Waiting for review" is the queue to work through. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(
				like(renter.businessName, `%${term}%`),
				like(renter.tinNumber, `%${term}%`),
				like(renter.phone, `%${term.replace(/^0/, '')}%`),
				like(user.email, `%${term}%`)
			),
		dateColumn: renter.createdAt,
		filters: {
			status: (v) =>
				(RENTER_STATUSES as readonly string[]).includes(v)
					? eq(renter.status, v as RenterStatus)
					: undefined
		}
	};
	const where = buildWhere(query, spec);

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: renter.id,
				businessName: renter.businessName,
				ownerName: user.name,
				email: user.email,
				phone: renter.phone,
				tinNumber: renter.tinNumber,
				status: renter.status,
				autoPublish: renter.autoPublish,
				createdAt: renter.createdAt
			})
			.from(renter)
			.innerJoin(user, eq(user.id, renter.userId))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(renter.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db
			.select({ total: count() })
			.from(renter)
			.innerJoin(user, eq(user.id, renter.userId))
			.where(where),
		facetCounts({
			status: () =>
				db
					.select({ value: renter.status, count: count() })
					.from(renter)
					.innerJoin(user, eq(user.id, renter.userId))
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(renter.status)
					.then((list) => list.map((f) => ({ ...f, label: RENTER_STATUS_LABELS[f.value] })))
		})
	]);

	const ids = rows.map((row) => row.id);
	const live = ids.length
		? await db
				.select({ renterId: renterListing.renterId, n: count() })
				.from(renterListing)
				.where(
					and(
						inArray(renterListing.renterId, ids),
						eq(renterListing.status, 'approved'),
						notDeleted(renterListing)
					)
				)
				.groupBy(renterListing.renterId)
		: [];

	return {
		rows: rows.map((row) => ({
			...row,
			live: Number(live.find((l) => l.renterId === row.id)?.n ?? 0)
		})),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
