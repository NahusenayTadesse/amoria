import { error } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { location, product, requisition, requisitionLine } from '$lib/server/db/schema';
import { REQUISITION_PURPOSE_LABELS } from '$lib/stock';
import { getSettings } from '$lib/server/services/settings';

/** The requisition as paper, for the storekeeper to pick from and the team to sign for. */
export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Requisition not found');
	const [row] = await db
		.select({ req: requisition, store: location.name })
		.from(requisition)
		.innerJoin(location, eq(location.id, requisition.locationId))
		.where(eq(requisition.id, id));
	if (!row) error(404, 'Requisition not found');
	const [lines, settings] = await Promise.all([
		db
			.select({
				id: requisitionLine.id,
				product: product.name,
				sku: product.sku,
				unit: product.unit,
				quantity: requisitionLine.quantity,
				approvedQuantity: requisitionLine.approvedQuantity,
				note: requisitionLine.note
			})
			.from(requisitionLine)
			.innerJoin(product, eq(product.id, requisitionLine.productId))
			.where(and(eq(requisitionLine.requisitionId, id), sql`${requisitionLine.deletedAt} IS NULL`))
			.orderBy(asc(requisitionLine.id)),
		getSettings()
	]);
	return {
		...row,
		purposeLabel: REQUISITION_PURPOSE_LABELS[row.req.purpose],
		lines,
		business: { name: 'Amoria', address: settings.address, phone: settings.businessPhone }
	};
};
