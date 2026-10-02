import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { product, stockDocument, stockDocumentLine } from '$lib/server/db/schema';
import { tillReturnPayload } from '$lib/schemas/inventory';
import { POS_METHOD_LABELS } from '$lib/stock';
import { actorOf } from '$lib/server/paymentAdmin';
import { currentShift, returnAtTill } from '$lib/server/services/inventory/pos';

/**
 * A customer brings back part of a till sale. Find the sale by its receipt number, choose what is
 * coming back, and the goods go onto the shelf while the refund is paid out of the drawer.
 */
export const load = async ({ url, locals }) => {
	const shift = await currentShift(locals.user!.id);
	const receipt = (url.searchParams.get('receipt') ?? '').trim();
	let sale = null;
	let notFound = false;

	if (receipt) {
		const [doc] = await db
			.select()
			.from(stockDocument)
			.where(
				and(
					eq(stockDocument.number, receipt.toUpperCase()),
					eq(stockDocument.type, 'issue'),
					eq(stockDocument.status, 'posted'),
					sql`${stockDocument.shiftId} IS NOT NULL`
				)
			);
		if (!doc) notFound = true;
		else {
			const lines = await db
				.select({
					id: stockDocumentLine.id,
					name: product.name,
					quantity: stockDocumentLine.quantity,
					unitPrice: stockDocumentLine.unitPrice
				})
				.from(stockDocumentLine)
				.innerJoin(product, eq(product.id, stockDocumentLine.productId))
				.where(eq(stockDocumentLine.documentId, doc.id))
				.orderBy(asc(stockDocumentLine.id));
			const returned = await db
				.select({
					lineId: stockDocumentLine.returnOfLineId,
					qty: sql<number>`SUM(${stockDocumentLine.quantity})`
				})
				.from(stockDocumentLine)
				.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
				.where(
					and(
						inArray(
							stockDocumentLine.returnOfLineId,
							lines.map((l) => l.id)
						),
						eq(stockDocument.status, 'posted')
					)
				)
				.groupBy(stockDocumentLine.returnOfLineId);
			const back = new Map(returned.map((r) => [r.lineId, Number(r.qty)]));
			sale = {
				id: doc.id,
				number: doc.number,
				total: doc.total,
				lines: lines.map((l) => ({
					...l,
					returnable: Math.max(0, l.quantity - (back.get(l.id) ?? 0))
				}))
			};
		}
	}
	return {
		hasShift: Boolean(shift),
		receipt,
		sale,
		notFound,
		methods: Object.entries(POS_METHOD_LABELS).map(([value, name]) => ({ value, name }))
	};
};

export const actions = {
	return: async (event) => {
		const data = await event.request.formData();
		let parsed;
		try {
			parsed = tillReturnPayload.safeParse(JSON.parse(String(data.get('payload') ?? '')));
		} catch {
			return fail(400, { error: 'That could not be read. Try again.' });
		}
		if (!parsed.success) return fail(400, { error: 'Choose what is coming back.' });
		let documentId: number;
		try {
			({ documentId } = await returnAtTill(parsed.data, actorOf(event)));
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
		redirect(303, `/dashboard/pos/receipt/${documentId}`);
	}
};
