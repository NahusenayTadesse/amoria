import { count, desc, eq, like, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
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
import { location, stockDocument, supplier } from '$lib/server/db/schema';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '$lib/constants';
import { DOCUMENT_LABELS, badge } from '$lib/stock';

const FILTERS = ['type', 'status'] as const;
const SORTS = { docDate: stockDocument.docDate, number: stockDocument.number };

/**
 * Every stock document, newest first: goods receipts, issues, transfers, adjustments and returns.
 * Drafts sort with the rest; the status filter finds them.
 */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 25, Object.keys(SORTS));
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) =>
			or(
				like(stockDocument.number, `%${term}%`),
				like(stockDocument.reference, `%${term}%`),
				like(stockDocument.party, `%${term}%`),
				like(supplier.name, `%${term}%`)
			),
		dateColumn: stockDocument.docDate,
		filters: {
			type: (v) =>
				(DOCUMENT_TYPES as readonly string[]).includes(v)
					? eq(stockDocument.type, v as (typeof DOCUMENT_TYPES)[number])
					: undefined,
			status: (v) =>
				(DOCUMENT_STATUSES as readonly string[]).includes(v)
					? eq(stockDocument.status, v as (typeof DOCUMENT_STATUSES)[number])
					: undefined
		}
	};
	const where = buildWhere(query, spec);
	const from = alias(location, 'from_location');
	const to = alias(location, 'to_location');

	const base = () =>
		db
			.select({ total: count() })
			.from(stockDocument)
			.leftJoin(supplier, eq(supplier.id, stockDocument.supplierId));

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: stockDocument.id,
				number: stockDocument.number,
				type: stockDocument.type,
				status: stockDocument.status,
				docDate: stockDocument.docDate,
				from: from.name,
				to: to.name,
				supplier: supplier.name,
				party: stockDocument.party,
				total: stockDocument.total,
				lines: sql<number>`(SELECT COUNT(*) FROM stock_document_line l WHERE l.document_id = \`stock_document\`.\`id\` AND l.deleted_at IS NULL)`
			})
			.from(stockDocument)
			.leftJoin(from, eq(from.id, stockDocument.fromLocationId))
			.leftJoin(to, eq(to.id, stockDocument.toLocationId))
			.leftJoin(supplier, eq(supplier.id, stockDocument.supplierId))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(stockDocument.docDate), desc(stockDocument.id)]))
			.limit(query.limit)
			.offset(query.offset),
		base().where(where),
		facetCounts({
			typeLabel: () =>
				db
					.select({ value: stockDocument.type, count: count() })
					.from(stockDocument)
					.leftJoin(supplier, eq(supplier.id, stockDocument.supplierId))
					.where(buildWhere(query, spec, { except: 'type' }))
					.groupBy(stockDocument.type)
					.then((list) => list.map((f) => ({ ...f, label: DOCUMENT_LABELS[f.value] }))),
			statusLabel: () =>
				db
					.select({ value: stockDocument.status, count: count() })
					.from(stockDocument)
					.leftJoin(supplier, eq(supplier.id, stockDocument.supplierId))
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(stockDocument.status)
					.then((list) => list.map((f) => ({ ...f, label: badge(f.value).label })))
		})
	]);

	return {
		rows: rows.map((r) => ({
			...r,
			lines: Number(r.lines),
			typeLabel: DOCUMENT_LABELS[r.type],
			statusLabel: badge(r.status).label
		})),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
