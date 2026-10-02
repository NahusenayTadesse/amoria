import { error } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	location,
	product,
	purchaseOrder,
	purchaseOrderLine,
	supplier
} from '$lib/server/db/schema';
import { getSettings } from '$lib/server/services/settings';

/** The order as paper, to hand or send to the supplier. */
export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Order not found');
	const [row] = await db
		.select({
			order: purchaseOrder,
			supplier: supplier.name,
			phone: supplier.phone,
			location: location.name
		})
		.from(purchaseOrder)
		.innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
		.innerJoin(location, eq(location.id, purchaseOrder.locationId))
		.where(eq(purchaseOrder.id, id));
	if (!row) error(404, 'Order not found');

	const [lines, settings] = await Promise.all([
		db
			.select({
				id: purchaseOrderLine.id,
				product: product.name,
				sku: product.sku,
				unit: product.unit,
				quantity: purchaseOrderLine.quantity,
				unitCost: purchaseOrderLine.unitCost,
				note: purchaseOrderLine.note
			})
			.from(purchaseOrderLine)
			.innerJoin(product, eq(product.id, purchaseOrderLine.productId))
			.where(
				and(eq(purchaseOrderLine.purchaseOrderId, id), sql`${purchaseOrderLine.deletedAt} IS NULL`)
			)
			.orderBy(asc(purchaseOrderLine.id)),
		getSettings()
	]);
	return {
		...row,
		lines,
		business: { name: 'Amoria', address: settings.address, phone: settings.businessPhone }
	};
};
