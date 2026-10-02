import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import {
	location,
	product,
	stockDocument,
	stockDocumentLine,
	stockLot,
	supplier,
	user
} from '$lib/server/db/schema';
import { DOCUMENT_LABELS } from '$lib/stock';
import { getSettings } from '$lib/server/services/settings';

/** A posted document as paper: for the delivery driver, the shelf, or the accountant. */
export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Document not found');
	const from = alias(location, 'from_location');
	const to = alias(location, 'to_location');

	const [row] = await db
		.select({
			doc: stockDocument,
			from: from.name,
			to: to.name,
			supplier: supplier.name,
			postedBy: user.name
		})
		.from(stockDocument)
		.leftJoin(from, eq(from.id, stockDocument.fromLocationId))
		.leftJoin(to, eq(to.id, stockDocument.toLocationId))
		.leftJoin(supplier, eq(supplier.id, stockDocument.supplierId))
		.leftJoin(user, eq(user.id, stockDocument.postedBy))
		.where(eq(stockDocument.id, id));
	if (!row) error(404, 'Document not found');

	const [lines, settings] = await Promise.all([
		db
			.select({
				id: stockDocumentLine.id,
				product: product.name,
				sku: product.sku,
				unit: product.unit,
				quantity: stockDocumentLine.quantity,
				unitCost: stockDocumentLine.unitCost,
				unitPrice: stockDocumentLine.unitPrice,
				lot: stockLot.lotNumber,
				lotNumber: stockDocumentLine.lotNumber,
				expiryDate: stockDocumentLine.expiryDate
			})
			.from(stockDocumentLine)
			.innerJoin(product, eq(product.id, stockDocumentLine.productId))
			.leftJoin(stockLot, eq(stockLot.id, stockDocumentLine.lotId))
			.where(eq(stockDocumentLine.documentId, id))
			.orderBy(asc(stockDocumentLine.id)),
		getSettings()
	]);

	return {
		...row,
		typeLabel: DOCUMENT_LABELS[row.doc.type],
		lines,
		business: { name: 'Amoria', address: settings.address, phone: settings.businessPhone }
	};
};
