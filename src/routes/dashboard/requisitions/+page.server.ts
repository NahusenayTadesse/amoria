import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { location, requisition } from '$lib/server/db/schema';
import { REQUISITION_PURPOSE_LABELS, badge } from '$lib/stock';

/** Every requisition, newest first: who asked, for what, and where it stands. */
export const load = async () => {
	const rows = await db
		.select({
			id: requisition.id,
			number: requisition.number,
			status: requisition.status,
			purpose: requisition.purpose,
			requester: requisition.requester,
			requestDate: requisition.requestDate,
			neededBy: requisition.neededBy,
			store: location.name,
			lines: sql<number>`(SELECT COUNT(*) FROM requisition_line l WHERE l.requisition_id = \`requisition\`.\`id\` AND l.deleted_at IS NULL)`
		})
		.from(requisition)
		.innerJoin(location, eq(location.id, requisition.locationId))
		.orderBy(desc(requisition.id));
	return {
		rows: rows.map((r) => ({
			...r,
			lines: Number(r.lines),
			purposeLabel: REQUISITION_PURPOSE_LABELS[r.purpose],
			statusLabel: badge(r.status).label
		}))
	};
};
