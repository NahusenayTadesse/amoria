import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import { category, location, stockCount } from '$lib/server/db/schema';
import { countLines } from '$lib/server/services/inventory/counts';
import { getSettings } from '$lib/server/services/settings';

/** The count sheet: what to count, with a blank box, for walking the shelves with a pen. */
export const load = async ({ params, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Count not found');
	const [row] = await db
		.select({ count: stockCount, location: location.name, category: category.name })
		.from(stockCount)
		.innerJoin(location, eq(location.id, stockCount.locationId))
		.leftJoin(category, eq(category.id, stockCount.categoryId))
		.where(eq(stockCount.id, id));
	if (!row) error(404, 'Count not found');
	const showExpected = !row.count.blind || hasPermission(locals, 'stock.adjust');
	const [lines, settings] = await Promise.all([countLines(id), getSettings()]);
	return {
		...row,
		showExpected,
		lines: lines.map((l) => ({ ...l, expected: showExpected ? l.expected : null })),
		business: { name: 'Amoria', address: settings.address, phone: settings.businessPhone }
	};
};
