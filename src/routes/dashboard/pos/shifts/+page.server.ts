import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { location, posShift, user } from '$lib/server/db/schema';
import { roundBirr } from '$lib/money';

/** Every till shift, newest first, with what the drawer should have held against what was counted. */
export const load = async () => {
	const rows = await db
		.select({
			id: posShift.id,
			status: posShift.status,
			openedAt: posShift.openedAt,
			closedAt: posShift.closedAt,
			cashier: user.name,
			location: location.name,
			floatAmount: posShift.floatAmount,
			expectedCash: posShift.expectedCash,
			countedCash: posShift.countedCash,
			sales: sql<number>`(SELECT COUNT(*) FROM stock_document d WHERE d.shift_id = \`pos_shift\`.\`id\` AND d.type = 'issue' AND d.status = 'posted')`
		})
		.from(posShift)
		.innerJoin(location, eq(location.id, posShift.locationId))
		.leftJoin(user, eq(user.id, posShift.openedBy))
		.orderBy(desc(posShift.id))
		.limit(200);
	return {
		rows: rows.map((r) => ({
			...r,
			sales: Number(r.sales),
			difference:
				r.countedCash != null && r.expectedCash != null
					? roundBirr(r.countedCash - r.expectedCash)
					: null
		}))
	};
};
