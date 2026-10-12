import { and, count, desc, eq, like, or } from 'drizzle-orm';
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
import { category, renter, renterListing } from '$lib/server/db/schema';
import { LISTING_STATUSES } from '$lib/constants';
import { LISTING_STATUS_LABELS, type ListingStatus } from '$lib/rentalMarket';

const FILTERS = ['status'] as const;
const SORTS = { updatedAt: renterListing.updatedAt, name: renterListing.name };

/**
 * Renters' listings for staff: the review queue is the "In review" filter (the Today board and the
 * renters page link straight to it); without a filter, everything, live ones included, to take one
 * down.
 */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(like(renterListing.name, `%${term}%`), like(renter.businessName, `%${term}%`)),
		dateColumn: renterListing.updatedAt,
		filters: {
			status: (v) =>
				(LISTING_STATUSES as readonly string[]).includes(v)
					? eq(renterListing.status, v as ListingStatus)
					: undefined
		}
	};
	const where = and(notDeleted(renterListing), buildWhere(query, spec));
	const from = () =>
		db
			.select({
				id: renterListing.id,
				name: renterListing.name,
				renterName: renter.businessName,
				renterId: renter.id,
				autoPublish: renter.autoPublish,
				categoryName: category.name,
				pricing: renterListing.pricing,
				price: renterListing.price,
				priceUnit: renterListing.priceUnit,
				status: renterListing.status,
				updatedAt: renterListing.updatedAt
			})
			.from(renterListing)
			.innerJoin(renter, eq(renter.id, renterListing.renterId))
			.innerJoin(category, eq(category.id, renterListing.categoryId));

	const [rows, [{ total }], facets] = await Promise.all([
		from()
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(renterListing.updatedAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db
			.select({ total: count() })
			.from(renterListing)
			.innerJoin(renter, eq(renter.id, renterListing.renterId))
			.where(where),
		facetCounts({
			status: () =>
				db
					.select({ value: renterListing.status, count: count() })
					.from(renterListing)
					.innerJoin(renter, eq(renter.id, renterListing.renterId))
					.where(and(notDeleted(renterListing), buildWhere(query, spec, { except: 'status' })))
					.groupBy(renterListing.status)
					.then((list) => list.map((f) => ({ ...f, label: LISTING_STATUS_LABELS[f.value] })))
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
