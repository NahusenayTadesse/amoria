import { count, desc, eq, like, or } from 'drizzle-orm';
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
import { eventType, quoteRequest } from '$lib/server/db/schema';
import { QUOTE_REQUEST_STATUSES } from '$lib/constants';
import { QUOTE_REQUEST_LABELS, type QuoteRequestStatus } from '$lib/quoteRequestStatus';

const FILTERS = ['status'] as const;
const SORTS = { createdAt: quoteRequest.createdAt, eventDate: quoteRequest.eventDate };

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));

	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(
				like(quoteRequest.contactName, `%${term}%`),
				like(quoteRequest.contactPhone, `%${term.replace(/^0/, '')}%`),
				like(quoteRequest.venue, `%${term}%`)
			),
		dateColumn: quoteRequest.createdAt,
		filters: {
			status: (v) =>
				(QUOTE_REQUEST_STATUSES as readonly string[]).includes(v)
					? eq(quoteRequest.status, v as QuoteRequestStatus)
					: undefined
		}
	};
	const where = buildWhere(query, spec);

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: quoteRequest.id,
				createdAt: quoteRequest.createdAt,
				contactName: quoteRequest.contactName,
				contactPhone: quoteRequest.contactPhone,
				eventName: eventType.name,
				eventDate: quoteRequest.eventDate,
				guestCount: quoteRequest.guestCount,
				preferredChannel: quoteRequest.preferredChannel,
				status: quoteRequest.status
			})
			.from(quoteRequest)
			.leftJoin(eventType, eq(eventType.id, quoteRequest.eventTypeId))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(quoteRequest.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(quoteRequest).where(where),
		facetCounts({
			status: () =>
				db
					.select({ value: quoteRequest.status, count: count() })
					.from(quoteRequest)
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(quoteRequest.status)
					.then((list) => list.map((f) => ({ ...f, label: QUOTE_REQUEST_LABELS[f.value] })))
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
