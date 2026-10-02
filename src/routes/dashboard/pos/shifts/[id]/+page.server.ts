import { error } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { stockDocument } from '$lib/server/db/schema';
import { shiftSummary } from '$lib/server/services/inventory/pos';
import { roundBirr } from '$lib/money';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';

export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Shift not found');
	let summary;
	try {
		summary = await shiftSummary(id);
	} catch (err) {
		if (err instanceof WriteRefused) error(404, 'Shift not found');
		throw err;
	}
	const sales = await db
		.select({
			id: stockDocument.id,
			number: stockDocument.number,
			type: stockDocument.type,
			total: stockDocument.total,
			postedAt: stockDocument.postedAt
		})
		.from(stockDocument)
		.where(
			and(
				eq(stockDocument.shiftId, id),
				eq(stockDocument.status, 'posted'),
				inArray(stockDocument.type, ['issue', 'sales_return'])
			)
		)
		.orderBy(desc(stockDocument.id));
	const s = summary.shift;
	return {
		summary,
		sales,
		difference:
			s.countedCash != null && s.expectedCash != null
				? roundBirr(s.countedCash - s.expectedCash)
				: null
	};
};
