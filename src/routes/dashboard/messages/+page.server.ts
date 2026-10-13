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
import { db } from '$lib/server/db';
import { quoteRequest } from '$lib/server/db/schema';
import { MESSAGE_LABELS, MESSAGE_STATUSES } from '$lib/quoteRequestStatus';

const FILTERS = ['status'] as const;
const SORTS = { createdAt: quoteRequest.createdAt };

/** Notes from the contact page's form (`quote_request` rows of kind `contact`). */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));

	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(
				like(quoteRequest.contactName, `%${term}%`),
				like(quoteRequest.contactPhone, `%${term.replace(/^0/, '')}%`),
				like(quoteRequest.message, `%${term}%`)
			),
		dateColumn: quoteRequest.createdAt,
		filters: {
			status: (v) =>
				(MESSAGE_STATUSES as readonly string[]).includes(v)
					? eq(quoteRequest.status, v as (typeof MESSAGE_STATUSES)[number])
					: undefined
		}
	};
	const isMessage = eq(quoteRequest.kind, 'contact');
	const where = and(isMessage, buildWhere(query, spec));

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: quoteRequest.id,
				createdAt: quoteRequest.createdAt,
				contactName: quoteRequest.contactName,
				contactPhone: quoteRequest.contactPhone,
				message: quoteRequest.message,
				preferredChannel: quoteRequest.preferredChannel,
				status: quoteRequest.status
			})
			.from(quoteRequest)
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
					.where(and(isMessage, buildWhere(query, spec, { except: 'status' })))
					.groupBy(quoteRequest.status)
					.then((list) =>
						list.map((f) => ({
							...f,
							label: MESSAGE_LABELS[f.value as keyof typeof MESSAGE_LABELS] ?? f.value
						}))
					)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
