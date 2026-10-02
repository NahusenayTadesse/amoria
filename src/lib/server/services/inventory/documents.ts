/**
 * Drafting stock documents: saving a draft with its lines, cancelling it, and drafting a return of
 * a posted sale or delivery. Posting is `post.ts`; nothing here changes stock.
 *
 * Documents are never deleted (§5.0): a draft that is dropped ends `cancelled`, and a posted one
 * is corrected by another document.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import type { Writer } from '@nahu/admin-kit/server/db';
import { transaction } from '$lib/server/db/retry';
import { product, stockDocument, stockDocumentLine } from '$lib/server/db/schema';
import type { DocumentType } from '$lib/constants';
import type { Actor } from '../payments/payable';

export type DocLineInput = {
	productId: number;
	quantity: number;
	unitCost?: number | null;
	unitPrice?: number | null;
	/** The price before a discount. */
	listPrice?: number | null;
	lotId?: number | null;
	lotNumber?: string | null;
	expiryDate?: string | null;
	returnOfLineId?: number | null;
	purchaseOrderLineId?: number | null;
	note?: string | null;
};

export type DocHeaderInput = Partial<
	Pick<
		typeof stockDocument.$inferInsert,
		| 'fromLocationId'
		| 'toLocationId'
		| 'reference'
		| 'supplierId'
		| 'party'
		| 'customerId'
		| 'reason'
		| 'note'
		| 'purchaseOrderId'
		| 'requisitionId'
		| 'shiftId'
		| 'returnOfId'
	>
> & { type: DocumentType; docDate: string };

/**
 * Creates a draft, or replaces the header and lines of an existing one. The whole document is
 * written in one transaction. A posted or cancelled document cannot be edited, and a draft never
 * changes its type.
 */
export async function saveDocument(
	input: { id?: number; header: DocHeaderInput; lines: DocLineInput[] },
	actor: Actor
): Promise<number> {
	return transaction((tx) => saveDocumentInTx(tx, input, actor));
}

/** `saveDocument` inside a transaction the caller already has (the till drafts and posts in one). */
export async function saveDocumentInTx(
	tx: Writer,
	input: { id?: number; header: DocHeaderInput; lines: DocLineInput[] },
	actor: Actor
): Promise<number> {
	const { header, lines } = input;
	if (!lines.length) throw new WriteRefused('lines', 'Add at least one line.');

	const ids = [...new Set(lines.map((l) => l.productId))];
	const found = await tx
		.select({ id: product.id })
		.from(product)
		.where(and(inArray(product.id, ids), sql`${product.deletedAt} IS NULL`));
	if (found.length !== ids.length) {
		throw new WriteRefused('lines', 'A product on this document no longer exists.');
	}

	let id = input.id;
	if (id) {
		const [existing] = await tx
			.select({ status: stockDocument.status, type: stockDocument.type })
			.from(stockDocument)
			.where(eq(stockDocument.id, id))
			.for('update');
		if (!existing) throw new WriteRefused(null, 'That document does not exist.');
		if (existing.status !== 'draft') {
			throw new WriteRefused(
				null,
				`That document is already ${existing.status}; it cannot change.`
			);
		}
		if (existing.type !== header.type) {
			throw new WriteRefused(null, 'A document cannot change its type.');
		}
		await tx.update(stockDocument).set(header).where(eq(stockDocument.id, id));
		await tx.delete(stockDocumentLine).where(eq(stockDocumentLine.documentId, id));
	} else {
		id = await insertReturningId(tx, stockDocument, {
			...header,
			createdBy: actor.locals.user?.id ?? null
		});
	}

	await tx.insert(stockDocumentLine).values(
		lines.map((l) => ({
			documentId: id!,
			productId: l.productId,
			quantity: l.quantity,
			unitCost: l.unitCost ?? null,
			unitPrice: l.unitPrice ?? null,
			listPrice: l.listPrice ?? null,
			lotId: l.lotId ?? null,
			lotNumber: l.lotNumber?.trim() || null,
			expiryDate: l.expiryDate || null,
			returnOfLineId: l.returnOfLineId ?? null,
			purchaseOrderLineId: l.purchaseOrderLineId ?? null,
			note: l.note?.trim() || null
		}))
	);
	return id!;
}

/**
 * Creates a draft with a header and no lines yet, or changes a draft's header. The dashboard makes
 * the draft first and adds its lines one at a time (`childCrud`); `saveDocument` is for callers
 * that already have every line.
 */
export async function saveHeader(
	input: { id?: number; header: DocHeaderInput },
	actor: Actor
): Promise<number> {
	return transaction(async (tx) => {
		if (!input.id) {
			return insertReturningId(tx, stockDocument, {
				...input.header,
				createdBy: actor.locals.user?.id ?? null
			});
		}
		const [existing] = await tx
			.select({ status: stockDocument.status, type: stockDocument.type })
			.from(stockDocument)
			.where(eq(stockDocument.id, input.id))
			.for('update');
		if (!existing) throw new WriteRefused(null, 'That document does not exist.');
		if (existing.status !== 'draft') {
			throw new WriteRefused(
				null,
				`That document is already ${existing.status}; it cannot change.`
			);
		}
		if (existing.type !== input.header.type) {
			throw new WriteRefused(null, 'A document cannot change its type.');
		}
		await tx.update(stockDocument).set(input.header).where(eq(stockDocument.id, input.id));
		return input.id;
	});
}

/** Drops a draft. It stays on record as `cancelled`; a posted document is corrected, not dropped. */
export async function cancelDocument(id: number, actor: Actor) {
	await transaction(async (tx) => {
		const [doc] = await tx
			.select({ status: stockDocument.status })
			.from(stockDocument)
			.where(eq(stockDocument.id, id))
			.for('update');
		if (!doc) throw new WriteRefused(null, 'That document does not exist.');
		if (doc.status !== 'draft') {
			throw new WriteRefused(
				null,
				doc.status === 'posted'
					? 'A posted document cannot be cancelled. Correct it with a return or an adjustment.'
					: 'That document is already cancelled.'
			);
		}
		await tx.update(stockDocument).set({ status: 'cancelled' }).where(eq(stockDocument.id, id));
		await recordAudit(tx, actor, {
			table: 'stock_document',
			recordId: id,
			action: 'update',
			before: { status: 'draft' },
			after: { status: 'cancelled' }
		});
	});
}

/**
 * Drafts the return of everything still returnable on a posted sale (a customer return) or
 * delivery (back to the supplier), at the original price or cost. The storekeeper lowers the
 * quantities to what actually comes back and posts it. Returns the new draft's id.
 */
export async function draftReturn(originalId: number, actor: Actor): Promise<number> {
	const [orig] = await readDocument(originalId);
	if (!orig) throw new WriteRefused(null, 'That document does not exist.');
	if (orig.status !== 'posted')
		throw new WriteRefused(null, 'Only a posted document can be returned.');
	if (orig.type !== 'issue' && orig.type !== 'receipt') {
		throw new WriteRefused(null, 'Only sales and deliveries can be returned.');
	}
	const type = orig.type === 'issue' ? 'sales_return' : 'purchase_return';

	const lines = await transaction(async (tx) => {
		const origLines = await tx
			.select()
			.from(stockDocumentLine)
			.where(eq(stockDocumentLine.documentId, originalId))
			.orderBy(asc(stockDocumentLine.id));
		const returned = await tx
			.select({
				lineId: stockDocumentLine.returnOfLineId,
				qty: sql<number>`SUM(${stockDocumentLine.quantity})`
			})
			.from(stockDocumentLine)
			.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
			.where(and(eq(stockDocument.returnOfId, originalId), eq(stockDocument.status, 'posted')))
			.groupBy(stockDocumentLine.returnOfLineId);
		const back = new Map(returned.map((r) => [r.lineId, Number(r.qty)]));
		return origLines
			.map((l) => ({ line: l, left: l.quantity - (back.get(l.id) ?? 0) }))
			.filter((x) => x.left > 0);
	});
	if (!lines.length) throw new WriteRefused(null, 'All of it has already been returned.');

	return saveDocument(
		{
			header: {
				type,
				docDate: new Date().toISOString().slice(0, 10),
				returnOfId: originalId,
				...(type === 'sales_return'
					? { toLocationId: orig.fromLocationId, customerId: orig.customerId }
					: { fromLocationId: orig.toLocationId, supplierId: orig.supplierId }),
				reference: orig.number
			},
			lines: lines.map(({ line, left }) => ({
				productId: line.productId,
				quantity: left,
				returnOfLineId: line.id,
				unitPrice: type === 'sales_return' ? line.unitPrice : null,
				unitCost: type === 'purchase_return' ? line.unitCost : null,
				lotNumber: null
			}))
		},
		actor
	);
}

async function readDocument(id: number) {
	return transaction((tx) =>
		tx.select().from(stockDocument).where(eq(stockDocument.id, id)).limit(1)
	);
}
