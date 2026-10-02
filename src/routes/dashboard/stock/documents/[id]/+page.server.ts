import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { z } from 'zod/v4';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import {
	location,
	product,
	stockDocument,
	stockDocumentLine,
	stockLot,
	stockMovement,
	supplier
} from '$lib/server/db/schema';
import { DOCUMENT_LABELS, badge } from '$lib/stock';
import { docLineAdd, docLineEdit, documentHeader } from '$lib/schemas/inventory';
import { locationOptions, lotOptions, productOptions, supplierOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { headerOf } from '$lib/server/documentForm';
import { attempt } from '$lib/server/attempt';
import { invalidate } from '$lib/server/cache';
import { cancelDocument, draftReturn, saveHeader } from '$lib/server/services/inventory/documents';
import { postDocument } from '$lib/server/services/inventory/post';

const RETURNS = ['sales_return', 'purchase_return'];

function documentId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Document not found');
	return id;
}

/** The draft every line write is filed under. A posted document's lines are its record: never edited. */
async function draftOf(id: number) {
	const [doc] = await db
		.select({ type: stockDocument.type, status: stockDocument.status })
		.from(stockDocument)
		.where(eq(stockDocument.id, id));
	if (!doc) throw new WriteRefused(null, 'That document does not exist.');
	if (doc.status !== 'draft') {
		throw new WriteRefused(
			null,
			`That document is already ${doc.status}; its lines cannot change.`
		);
	}
	return doc;
}

/** Lines of a receipt, issue, transfer or adjustment: the kit's owner-scoped child CRUD. */
const lines = childCrud({
	table: stockDocumentLine,
	ownerColumn: 'documentId',
	label: 'Line',
	addSchema: docLineAdd,
	editSchema: docLineEdit,
	permission: 'stock.adjust',
	transform: async (values, event) => {
		const doc = await draftOf(documentId(event.params));
		if (RETURNS.includes(doc.type)) {
			throw new WriteRefused(
				'productId',
				"A return's lines are what the original moved. Only their quantities can change."
			);
		}
		const quantity = Number(values.quantity);
		if (doc.type !== 'adjustment' && quantity < 0) {
			throw new WriteRefused('quantity', 'Enter a quantity above zero.');
		}
		return {
			...values,
			unitCost: values.unitCost ?? null,
			unitPrice: doc.type === 'issue' ? (values.unitPrice ?? null) : null,
			lotId: values.lotId ?? null,
			lotNumber: values.lotNumber || null,
			expiryDate: values.expiryDate || null,
			note: values.note || null
		};
	}
});

/** A return's lines were made from the original; the storekeeper lowers them to what came back. */
const returnQuantity = z.object({
	id: z.coerce.number(),
	quantity: z.coerce.number('Enter how many').int('A whole number').min(1, 'At least 1')
});
const returnLines = childCrud({
	table: stockDocumentLine,
	ownerColumn: 'documentId',
	label: 'Returned line',
	addSchema: returnQuantity.omit({ id: true }),
	editSchema: returnQuantity,
	permission: 'stock.adjust',
	transform: async (values, event, before) => {
		const doc = await draftOf(documentId(event.params));
		if (!RETURNS.includes(doc.type) || !before) {
			throw new WriteRefused('quantity', 'Only the quantities of a return can change.');
		}
		if (Number(values.quantity) > Number(before.quantity)) {
			throw new WriteRefused('quantity', `Cannot be more than the ${before.quantity} drafted.`);
		}
		return { quantity: values.quantity };
	}
});

export const load = async ({ params }) => {
	const id = documentId(params);
	const from = alias(location, 'from_location');
	const to = alias(location, 'to_location');
	const original = alias(stockDocument, 'original');

	const [row] = await db
		.select({
			doc: stockDocument,
			from: from.name,
			to: to.name,
			supplier: supplier.name,
			originalNumber: original.number,
			originalId: original.id
		})
		.from(stockDocument)
		.leftJoin(from, eq(from.id, stockDocument.fromLocationId))
		.leftJoin(to, eq(to.id, stockDocument.toLocationId))
		.leftJoin(supplier, eq(supplier.id, stockDocument.supplierId))
		.leftJoin(original, eq(original.id, stockDocument.returnOfId))
		.where(eq(stockDocument.id, id));
	if (!row) error(404, 'Document not found');
	const doc = row.doc;
	const isDraft = doc.status === 'draft';
	const isReturn = RETURNS.includes(doc.type);

	const [products, lots, made] = await Promise.all([
		isDraft && !isReturn ? productOptions() : Promise.resolve([]),
		isDraft && !isReturn ? lotOptions() : Promise.resolve([]),
		// Returns already drafted or posted against this document.
		db
			.select({ id: stockDocument.id, number: stockDocument.number, status: stockDocument.status })
			.from(stockDocument)
			.where(eq(stockDocument.returnOfId, id))
			.orderBy(asc(stockDocument.id))
	]);

	// A draft's lines through the kit's section; a posted document's lines as a plain table.
	const linePage = isDraft ? await (isReturn ? returnLines : lines).load(id) : null;
	const named = await db
		.select({
			id: stockDocumentLine.id,
			productId: stockDocumentLine.productId,
			product: product.name,
			unit: product.unit,
			quantity: stockDocumentLine.quantity,
			unitCost: stockDocumentLine.unitCost,
			unitPrice: stockDocumentLine.unitPrice,
			vatRate: stockDocumentLine.vatRate,
			lotId: stockDocumentLine.lotId,
			lot: stockLot.lotNumber,
			lotNumber: stockDocumentLine.lotNumber,
			expiryDate: stockDocumentLine.expiryDate,
			note: stockDocumentLine.note
		})
		.from(stockDocumentLine)
		.innerJoin(product, eq(product.id, stockDocumentLine.productId))
		.leftJoin(stockLot, eq(stockLot.id, stockDocumentLine.lotId))
		.where(and(eq(stockDocumentLine.documentId, id), sql`${stockDocumentLine.deletedAt} IS NULL`))
		.orderBy(asc(stockDocumentLine.id));
	const byId = new Map(named.map((l) => [l.id, l]));

	const movements = isDraft
		? []
		: await db
				.select({
					id: stockMovement.id,
					product: product.name,
					location: location.name,
					lot: stockLot.lotNumber,
					delta: stockMovement.delta,
					unitCost: stockMovement.unitCost,
					reason: stockMovement.reason
				})
				.from(stockMovement)
				.innerJoin(product, eq(product.id, stockMovement.productId))
				.innerJoin(location, eq(location.id, stockMovement.locationId))
				.leftJoin(stockLot, eq(stockLot.id, stockMovement.lotId))
				.where(eq(stockMovement.documentId, id))
				.orderBy(asc(stockMovement.id));

	return {
		doc,
		typeLabel: DOCUMENT_LABELS[doc.type],
		badge: badge(doc.status),
		where: { from: row.from, to: row.to, supplier: row.supplier },
		original: row.originalId ? { id: row.originalId, number: row.originalNumber } : null,
		returnsMade: made.map((r) => ({ ...r, badge: badge(r.status) })),
		isDraft,
		isReturn,
		lines: named,
		lineSection: linePage
			? {
					addForm: linePage.addForm,
					editForm: linePage.editForm,
					// The kit's rows carry the raw columns; the section shows names.
					rows: linePage.rows.map((r) => ({ ...byId.get(r.id), ...r }))
				}
			: null,
		movements,
		options: { products, lots },
		headerForm: isDraft
			? await superValidate(
					{
						type: doc.type as 'receipt',
						docDate: doc.docDate,
						fromLocationId: doc.fromLocationId ?? undefined,
						toLocationId: doc.toLocationId ?? undefined,
						supplierId: doc.supplierId ?? undefined,
						customerId: doc.customerId ?? undefined,
						party: doc.party ?? '',
						reference: doc.reference ?? '',
						reason: doc.reason ?? '',
						note: doc.note ?? ''
					},
					zod4(documentHeader)
				)
			: null,
		pickers:
			isDraft && !isReturn
				? {
						locations: await locationOptions({
							withQuarantine: doc.type === 'transfer' || doc.type === 'adjustment'
						}),
						suppliers: await supplierOptions()
					}
				: { locations: [], suppliers: [] }
	};
};

/** A line write changes what posting will do, and the shop's cached lists on the next post. */
const touched = <T>(result: T) => {
	invalidate('catalog');
	return result;
};

export const actions = {
	header: async (event) => {
		const id = documentId(event.params);
		const form = await superValidate(event.request, zod4(documentHeader));
		if (!form.valid) return fail(400, { form });
		try {
			await saveHeader(
				{
					id,
					header: headerOf(form.data)
				},
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Details saved' });
	},

	addLine: async (event) => touched(await lines.actions.add(event, documentId(event.params))),
	editLine: async (event) => touched(await lines.actions.edit(event, documentId(event.params))),
	deleteLine: async (event) => touched(await lines.actions.delete(event, documentId(event.params))),
	editReturnLine: async (event) =>
		touched(await returnLines.actions.edit(event, documentId(event.params))),

	post: async (event) => {
		const id = documentId(event.params);
		return attempt(async () => {
			const { number } = await postDocument(id, actorOf(event));
			return { number };
		}, 'Posted. Stock has changed.');
	},

	cancel: async (event) => {
		const id = documentId(event.params);
		const result = await attempt(() => cancelDocument(id, actorOf(event)), 'Draft dropped');
		if ('data' in result) return result; // a refusal
		redirect(303, '/dashboard/stock/documents');
	},

	/** A customer return or a return to the supplier, drafted from what is still returnable. */
	draftReturn: async (event) => {
		const id = documentId(event.params);
		let made: number | null = null;
		const result = await attempt(async () => {
			made = await draftReturn(id, actorOf(event));
		}, 'Return drafted');
		if ('data' in result || made === null) return result;
		redirect(303, `/dashboard/stock/documents/${made}`);
	}
};
