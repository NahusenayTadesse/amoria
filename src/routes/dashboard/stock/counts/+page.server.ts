import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { category, location, stockCount, stockDocument } from '$lib/server/db/schema';
import { badge } from '$lib/stock';

/** Every stock count, newest first. There are few, so the table pages in the browser. */
export const load = async () => {
	const rows = await db
		.select({
			id: stockCount.id,
			status: stockCount.status,
			countDate: stockCount.countDate,
			blind: stockCount.blind,
			location: location.name,
			category: category.name,
			lines: sql<number>`(SELECT COUNT(*) FROM stock_count_line l WHERE l.count_id = \`stock_count\`.\`id\`)`,
			counted: sql<number>`(SELECT COUNT(*) FROM stock_count_line l WHERE l.count_id = \`stock_count\`.\`id\` AND l.counted IS NOT NULL)`,
			adjustment: stockDocument.number
		})
		.from(stockCount)
		.innerJoin(location, eq(location.id, stockCount.locationId))
		.leftJoin(category, eq(category.id, stockCount.categoryId))
		.leftJoin(stockDocument, eq(stockDocument.id, stockCount.adjustmentId))
		.orderBy(desc(stockCount.id));
	return {
		rows: rows.map((r) => ({
			...r,
			lines: Number(r.lines),
			counted: Number(r.counted),
			statusLabel: badge(r.status).label
		}))
	};
};
