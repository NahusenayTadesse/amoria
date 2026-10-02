import { error } from '@sveltejs/kit';
import { count, sql } from 'drizzle-orm';
import { addLocalDays, isIsoDate, localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { product } from '$lib/server/db/schema';
import {
	abcAnalysis,
	lastDays,
	movementsOverTime,
	purchasesBySupplier,
	salesSummary,
	slowMoving,
	stockOuts,
	stockTrend,
	stockValue,
	topUsed,
	vatReport,
	writeOffs,
	type Period
} from '$lib/server/services/inventory/reports';
import { expiryReport } from '$lib/server/services/inventory/expiry';
import { getSettings } from '$lib/server/services/settings';
import { productOptions } from '$lib/server/options';
import { REPORTS, type ReportName } from '$lib/stock';

function periodOf(url: URL): Period {
	const today = localToday();
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const period =
		isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : lastDays(30, today);
	// A period longer than a year is a slow query for no reader: cap it.
	if (period.from < addLocalDays(period.to, -366)) period.from = addLocalDays(period.to, -366);
	return period;
}

export const load = async ({ params, url }) => {
	const name = params.report as ReportName | undefined;
	const period = periodOf(url);

	if (!name) {
		const [{ lowCount }] = await db
			.select({ lowCount: count() })
			.from(product)
			.where(
				sql`${product.deletedAt} IS NULL AND ${product.isActive} = 1 AND ${product.stockQty} <= COALESCE(${product.lowStockThreshold}, ${(await getSettings()).lowStockDefault})`
			);
		const [value, sales, expiring, slow] = await Promise.all([
			stockValue(),
			salesSummary(lastDays(30)),
			expiryReport(),
			slowMoving({ days: 90 })
		]);
		return {
			period,
			view: {
				kind: 'overview' as const,
				stockValue: value.total,
				sales30: sales.net,
				low: Number(lowCount),
				expiring: expiring.filter((r) => r.state !== 'flagged').length,
				slowValue: slow.reduce((sum, r) => sum + r.value, 0),
				slowCount: slow.length
			},
			reports: REPORTS
		};
	}
	if (!(name in REPORTS)) error(404, 'No such report');

	const base = { period, reports: REPORTS, name };
	switch (name) {
		case 'value':
			return { ...base, view: { kind: 'value' as const, ...(await stockValue()) } };
		case 'movement':
			return { ...base, view: { kind: 'movement' as const, ...(await movementsOverTime(period)) } };
		case 'usage':
			return { ...base, view: { kind: 'usage' as const, rows: await topUsed(period, 50) } };
		case 'write-offs':
			return { ...base, view: { kind: 'write-offs' as const, rows: await writeOffs(period) } };
		case 'buying':
			return {
				...base,
				view: { kind: 'buying' as const, rows: await purchasesBySupplier(period) }
			};
		case 'sales': {
			const [summary, byRevenue] = await Promise.all([
				salesSummary(period),
				abcAnalysis(period, 'revenue')
			]);
			return { ...base, view: { kind: 'sales' as const, summary, top: byRevenue.slice(0, 15) } };
		}
		case 'slow': {
			const days = Math.max(1, Number(url.searchParams.get('idle')) || 90);
			return {
				...base,
				view: { kind: 'slow' as const, days, rows: await slowMoving({ days }) }
			};
		}
		case 'abc': {
			const by = url.searchParams.get('by') === 'revenue' ? 'revenue' : 'cost';
			return { ...base, view: { kind: 'abc' as const, by, rows: await abcAnalysis(period, by) } };
		}
		case 'stock-outs':
			return { ...base, view: { kind: 'stock-outs' as const, rows: await stockOuts(period) } };
		case 'trend': {
			const id = Number(url.searchParams.get('product'));
			const products = await productOptions();
			return {
				...base,
				view: {
					kind: 'trend' as const,
					products,
					productId: Number.isInteger(id) && id > 0 ? id : null,
					trend: Number.isInteger(id) && id > 0 ? await stockTrend(id, period) : null,
					name: products.find((p) => p.value === id)?.name ?? null
				}
			};
		}
		case 'vat':
			return { ...base, view: { kind: 'vat' as const, ...(await vatReport(period)) } };
	}
};
