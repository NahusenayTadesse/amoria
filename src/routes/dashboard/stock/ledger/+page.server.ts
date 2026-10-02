import { count, desc, eq, like } from 'drizzle-orm';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { db } from '$lib/server/db';
import { location, product, stockLot, stockMovement, user } from '$lib/server/db/schema';
import { STOCK_REASONS, PRODUCT_KINDS } from '$lib/constants';
import { PRODUCT_KIND_LABELS, STOCK_REASON_META, type StockReason } from '$lib/stock';

const FILTERS = ['reason', 'kind'] as const;

/** The whole stock ledger, newest first, for every product the site keeps. Append-only. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 50);
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		search: (term) => like(product.name, `%${term}%`),
		dateColumn: stockMovement.createdAt,
		filters: {
			reason: (v) =>
				(STOCK_REASONS as readonly string[]).includes(v)
					? eq(stockMovement.reason, v as StockReason)
					: undefined,
			kind: (v) =>
				(PRODUCT_KINDS as readonly string[]).includes(v)
					? eq(product.kind, v as 'gift' | 'rental')
					: undefined
		}
	};
	const where = buildWhere(query, spec);

	const base = () =>
		db
			.select({ total: count() })
			.from(stockMovement)
			.innerJoin(product, eq(product.id, stockMovement.productId));

	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: stockMovement.id,
				createdAt: stockMovement.createdAt,
				productId: stockMovement.productId,
				product: product.name,
				kind: product.kind,
				reason: stockMovement.reason,
				delta: stockMovement.delta,
				refType: stockMovement.refType,
				refId: stockMovement.refId,
				note: stockMovement.note,
				location: location.name,
				lot: stockLot.lotNumber,
				unitCost: stockMovement.unitCost,
				by: user.name
			})
			.from(stockMovement)
			.innerJoin(product, eq(product.id, stockMovement.productId))
			.innerJoin(location, eq(location.id, stockMovement.locationId))
			.leftJoin(stockLot, eq(stockLot.id, stockMovement.lotId))
			.leftJoin(user, eq(user.id, stockMovement.createdBy))
			.where(where)
			.orderBy(desc(stockMovement.id))
			.limit(query.limit)
			.offset(query.offset),
		base().where(where),
		facetCounts({
			reason: () =>
				db
					.select({ value: stockMovement.reason, count: count() })
					.from(stockMovement)
					.innerJoin(product, eq(product.id, stockMovement.productId))
					.where(buildWhere(query, spec, { except: 'reason' }))
					.groupBy(stockMovement.reason)
					.then((list) =>
						list.map((f) => ({ ...f, label: STOCK_REASON_META[f.value]?.label ?? f.value }))
					),
			kindLabel: () =>
				db
					.select({ value: product.kind, count: count() })
					.from(stockMovement)
					.innerJoin(product, eq(product.id, stockMovement.productId))
					.where(buildWhere(query, spec, { except: 'kind' }))
					.groupBy(product.kind)
					.then((list) => list.map((f) => ({ ...f, label: PRODUCT_KIND_LABELS[f.value] })))
		})
	]);

	return {
		rows: rows.map((row) => ({ ...row, kindLabel: PRODUCT_KIND_LABELS[row.kind] })),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
