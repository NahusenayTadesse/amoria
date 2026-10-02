/**
 * Posting: the way a stock document becomes stock.
 *
 * A draft is checked line by line and, if every line is possible, turned into ledger movements
 * (`ledger.move`) — all in one transaction, so a document posts entirely or not at all. Anything
 * that cannot be posted throws `WriteRefused` naming the product, and nothing is written.
 *
 * Rules enforced here, not in the forms, because a form is only one way to reach this:
 *   - stock never goes negative; an issue larger than the shelf is refused, not clipped
 *   - expired, quarantined and recalled lots are never issued or sold — only written off by an
 *     adjustment, or moved into a quarantine location
 *   - lot numbers are required on deliveries of products that track lots; expired stock cannot be
 *     received
 *   - the average cost moves only on stock coming in from a supplier (or opening stock)
 *   - a return is checked against what is left of the document it returns
 *   - a sale fixes each line's VAT rate and the document's totals when it is posted, so later
 *     changes to the settings never rewrite a posted sale
 */
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localToday } from '@nahu/admin-kit/time';
import { transaction } from '$lib/server/db/retry';
import { invalidate } from '$lib/server/cache';
import {
	location,
	product,
	requisition,
	stockDocument,
	stockDocumentLine,
	stockLot,
	stockMovement,
	supplier
} from '$lib/server/db/schema';
import type { ADJUSTMENT_REASONS, STOCK_REASONS } from '$lib/constants';
import { roundBirr, sumBirr } from '$lib/money';
import { isExpired, vatWithin } from '$lib/stockMath';
import type { Actor } from '../payments/payable';
import { getSettings, type Settings } from '../settings';
import { move, moveDetailed, StockShortError } from './ledger';
import { nextNumber } from './numbering';
import { refreshOrderStatus } from './purchasing';

type Doc = typeof stockDocument.$inferSelect;
type Line = typeof stockDocumentLine.$inferSelect;
type Product = Pick<
	typeof product.$inferSelect,
	'id' | 'name' | 'kind' | 'trackLots' | 'avgCost' | 'price' | 'taxCode' | 'deletedAt'
>;
type Place = { id: number; name: string; kind: 'shop' | 'storage' | 'workshop' | 'quarantine' };

type Ctx = {
	tx: Writer;
	doc: Doc;
	actor: Actor;
	today: string;
	products: Map<number, Product>;
	places: Map<number, Place>;
};

const refuse = (message: string, field: string | null = null): never => {
	throw new WriteRefused(field, message);
};

/** How an adjustment's reason is written in the ledger. */
const ADJUSTMENT_LEDGER: Record<
	(typeof ADJUSTMENT_REASONS)[number],
	(typeof STOCK_REASONS)[number]
> = {
	count: 'adjustment',
	damage: 'damage',
	expiry: 'expiry',
	found: 'adjustment',
	opening: 'opening',
	other: 'adjustment'
};

/**
 * Posts a draft document. Returns its new number. Runs in its own transaction; use `postInTx` from
 * a service that must post inside a transaction it already has (a count, a requisition, the till).
 */
export async function postDocument(documentId: number, actor: Actor) {
	const settings = await getSettings();
	const result = await transaction((tx) => postInTx(tx, documentId, actor, settings));
	invalidate('catalog');
	return result;
}

export async function postInTx(
	tx: Writer,
	documentId: number,
	actor: Actor,
	settings: Settings,
	options: { today?: string } = {}
): Promise<{ number: string; total: number | null }> {
	const [doc] = await tx
		.select()
		.from(stockDocument)
		.where(eq(stockDocument.id, documentId))
		.for('update');
	if (!doc) return refuse('That document does not exist.');
	if (doc.status !== 'draft') return refuse(`That document is already ${doc.status}.`);

	// Lines struck out while drafting are gone for good once the document posts.
	await tx
		.delete(stockDocumentLine)
		.where(and(eq(stockDocumentLine.documentId, doc.id), isNotNull(stockDocumentLine.deletedAt)));
	const lines = await tx
		.select()
		.from(stockDocumentLine)
		.where(eq(stockDocumentLine.documentId, doc.id))
		.orderBy(asc(stockDocumentLine.id));
	if (!lines.length) return refuse('Add at least one line first.');

	const locationIds = [doc.fromLocationId, doc.toLocationId].filter((id): id is number => !!id);
	const placeRows = locationIds.length
		? await tx
				.select({ id: location.id, name: location.name, kind: location.kind })
				.from(location)
				.where(and(inArray(location.id, locationIds), isNull(location.deletedAt)))
		: [];

	const productIds = [...new Set(lines.map((l) => l.productId))].sort((a, b) => a - b);
	const productRows = await tx
		.select({
			id: product.id,
			name: product.name,
			kind: product.kind,
			trackLots: product.trackLots,
			avgCost: product.avgCost,
			price: product.price,
			taxCode: product.taxCode,
			deletedAt: product.deletedAt
		})
		.from(product)
		.where(inArray(product.id, productIds))
		.orderBy(asc(product.id))
		.for('update');

	const ctx: Ctx = {
		tx,
		doc,
		actor,
		today: options.today ?? localToday(),
		products: new Map(productRows.map((p) => [p.id, p])),
		places: new Map(placeRows.map((p) => [p.id, p]))
	};
	for (const id of productIds) {
		const p = ctx.products.get(id);
		if (!p || p.deletedAt) refuse('A product on this document no longer exists.');
	}

	const from = doc.fromLocationId ? ctx.places.get(doc.fromLocationId) : undefined;
	const to = doc.toLocationId ? ctx.places.get(doc.toLocationId) : undefined;

	switch (doc.type) {
		case 'receipt':
			if (!to) refuse('Choose where the goods were received.', 'toLocationId');
			if (!doc.supplierId) refuse('Choose who delivered the goods.', 'supplierId');
			await fixPurchaseVat(
				ctx,
				lines,
				(await requireSupplier(ctx, doc.supplierId!)).vatRegistered,
				settings
			);
			break;
		case 'issue':
		case 'adjustment':
			if (!from) refuse('Choose the location the stock is at.', 'fromLocationId');
			break;
		case 'sales_return':
			if (!to) refuse('Choose where the returned goods go.', 'toLocationId');
			if (!doc.returnOfId) refuse('A return names the sale it returns.');
			break;
		case 'purchase_return':
			if (!from) refuse('Choose where the goods leave from.', 'fromLocationId');
			if (!doc.supplierId) refuse('A return to a supplier names the supplier.', 'supplierId');
			if (!doc.returnOfId) refuse('A return names the delivery it returns.');
			break;
		case 'transfer':
			if (!from || !to) refuse('Choose both locations.');
			if (from!.id === to!.id) refuse('Choose two different locations.');
			break;
	}

	// Lines in ascending product order, so concurrent postings lock products in the same order.
	const ordered = [...lines].sort((a, b) => a.productId - b.productId || a.id - b.id);
	for (const line of ordered) {
		if (!line.quantity) {
			refuse(`Enter a quantity for ${ctx.products.get(line.productId)!.name}.`);
		}
		if (line.quantity < 0 && doc.type !== 'adjustment') {
			refuse(`${ctx.products.get(line.productId)!.name}: the quantity must be more than zero.`);
		}
		try {
			await postLine(ctx, line, from, to);
		} catch (err) {
			if (err instanceof StockShortError) {
				const p = ctx.products.get(line.productId)!;
				refuse(
					err.available === 0
						? `There is none of ${p.name} to take from ${from?.name ?? 'there'}.`
						: `Only ${err.available} of ${p.name} at ${from?.name ?? 'that location'}; you asked for ${Math.abs(line.quantity)}.`
				);
			}
			throw err;
		}
	}

	const totals = doc.type === 'issue' ? await priceSale(ctx, lines, settings) : null;
	const number = await nextNumber(tx, doc.type, doc.docDate);

	await tx
		.update(stockDocument)
		.set({
			status: 'posted',
			number,
			postedAt: new Date(),
			postedBy: actor.locals.user?.id ?? null,
			...(totals ?? {})
		})
		.where(eq(stockDocument.id, doc.id));

	if (doc.type === 'receipt' && doc.purchaseOrderId) {
		await refreshOrderStatus(tx, doc.purchaseOrderId);
	}
	// The issue that fills an approved requisition closes it.
	if (doc.type === 'issue' && doc.requisitionId) {
		await tx
			.update(requisition)
			.set({ status: 'issued' })
			.where(and(eq(requisition.id, doc.requisitionId), eq(requisition.status, 'approved')));
	}

	await recordAudit(tx, actor, {
		table: 'stock_document',
		recordId: doc.id,
		action: 'update',
		before: { status: 'draft' },
		after: { status: 'posted', number },
		detail: { type: doc.type, lines: lines.length }
	});

	return { number, total: totals?.total ?? null };
}

async function requireSupplier(ctx: Ctx, supplierId: number) {
	const [found] = await ctx.tx
		.select({ id: supplier.id, vatRegistered: supplier.vatRegistered })
		.from(supplier)
		.where(and(eq(supplier.id, supplierId), isNull(supplier.deletedAt)));
	if (!found) refuse('That supplier no longer exists.', 'supplierId');
	return found!;
}

/**
 * Deliveries: the VAT on each line is fixed now — the shop's rate on standard-rated products,
 * when both the shop and the supplier are VAT-registered — so the input VAT on the purchases
 * register never changes after the fact. Costs on lines are before VAT.
 */
async function fixPurchaseVat(ctx: Ctx, lines: Line[], supplierVat: boolean, settings: Settings) {
	for (const line of lines) {
		const p = ctx.products.get(line.productId)!;
		const rate =
			settings.vatRegistered && supplierVat && p.taxCode === 'standard' ? settings.vatRate : null;
		if (line.vatRate !== rate) {
			await ctx.tx
				.update(stockDocumentLine)
				.set({ vatRate: rate })
				.where(eq(stockDocumentLine.id, line.id));
		}
	}
}

/** One line becomes one or two movements, by the kind of document. */
async function postLine(ctx: Ctx, line: Line, from?: Place, to?: Place) {
	const { doc } = ctx;
	const p = ctx.products.get(line.productId)!;
	const qty = line.quantity;
	const base = {
		productId: p.id,
		refType: 'document',
		refId: doc.id,
		documentId: doc.id,
		docDate: doc.docDate,
		createdBy: ctx.actor.locals.user?.id ?? null,
		note: line.note ?? undefined
	};

	switch (doc.type) {
		case 'receipt': {
			const lotId = await lotFor(ctx, p, line, doc.supplierId);
			const cost = line.unitCost ?? p.avgCost;
			if (line.unitCost == null) {
				await ctx.tx
					.update(stockDocumentLine)
					.set({ unitCost: cost })
					.where(eq(stockDocumentLine.id, line.id));
			}
			await move(ctx.tx, {
				...base,
				delta: qty,
				reason: 'delivery',
				locationId: to!.id,
				lotId,
				unitCost: cost,
				revalue: true
			});
			return;
		}
		case 'issue': {
			await move(ctx.tx, {
				...base,
				delta: -qty,
				reason: doc.shiftId ? 'pos_sale' : 'issue',
				locationId: from!.id,
				lotId: line.lotId
			});
			return;
		}
		case 'transfer': {
			const unusableOk = from!.kind === 'quarantine' || to!.kind === 'quarantine';
			const out = await moveDetailed(ctx.tx, {
				...base,
				delta: -qty,
				reason: 'transfer_out',
				locationId: from!.id,
				lotId: line.lotId,
				allowUnusable: unusableOk
			});
			// Exactly the lots that left arrive, so expiry dates travel with the stock.
			for (const t of out.touched) {
				await move(ctx.tx, {
					...base,
					delta: -t.delta,
					reason: 'transfer_in',
					locationId: to!.id,
					lotId: t.lotId
				});
			}
			return;
		}
		case 'adjustment': {
			const reason = ADJUSTMENT_LEDGER[doc.reason ?? 'other'];
			if (qty > 0) {
				const lotId = await lotFor(ctx, p, line, null);
				await move(ctx.tx, {
					...base,
					delta: qty,
					reason,
					locationId: from!.id,
					lotId,
					unitCost: line.unitCost ?? undefined,
					revalue: reason === 'opening' && line.unitCost != null
				});
			} else {
				await move(ctx.tx, {
					...base,
					delta: qty,
					reason,
					locationId: from!.id,
					lotId: line.lotId,
					// A count names the exact bucket that was short: no lot means the stock with no lot.
					exactLot: doc.reason === 'count',
					allowUnusable: true
				});
			}
			return;
		}
		case 'sales_return':
			await returnToShelf(ctx, line, p, to!);
			return;
		case 'purchase_return':
			await returnToSupplier(ctx, line, p, from!);
			return;
	}
}

/**
 * The lot a delivery (or a positive adjustment) belongs to: created from the line's lot number and
 * expiry date, or the existing lot of that number. Products that do not track lots have none.
 */
async function lotFor(ctx: Ctx, p: Product, line: Line, supplierId: number | null) {
	if (!p.trackLots) {
		if (line.lotNumber) refuse(`${p.name} does not track lots; clear the lot number.`);
		return null;
	}
	if (line.lotId) return line.lotId;
	const number = line.lotNumber?.trim();
	if (!number) refuse(`${p.name} tracks lots: enter its lot number.`);
	if (isExpired(line.expiryDate, ctx.today)) {
		refuse(`${p.name}: lot ${number} is already past its expiry date.`);
	}
	const [existing] = await ctx.tx
		.select()
		.from(stockLot)
		.where(and(eq(stockLot.productId, p.id), eq(stockLot.lotNumber, number!)))
		.for('update');
	if (existing) {
		if (line.expiryDate && existing.expiryDate && existing.expiryDate !== line.expiryDate) {
			refuse(
				`${p.name}: lot ${number} is already on record with the expiry ${existing.expiryDate}.`
			);
		}
		return existing.id;
	}
	const [{ id }] = await ctx.tx
		.insert(stockLot)
		.values({
			productId: p.id,
			lotNumber: number!,
			expiryDate: line.expiryDate,
			supplierId
		})
		.$returningId();
	return id;
}

/** What is left to return of an original line, and the lots it left from. */
async function originalLine(ctx: Ctx, line: Line, p: Product, type: 'issue' | 'receipt') {
	if (!line.returnOfLineId) refuse(`${p.name}: say which line of the original it returns.`);
	const [orig] = await ctx.tx
		.select({
			line: stockDocumentLine,
			docId: stockDocument.id,
			docType: stockDocument.type,
			docStatus: stockDocument.status
		})
		.from(stockDocumentLine)
		.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
		.where(eq(stockDocumentLine.id, line.returnOfLineId!));
	if (
		!orig ||
		orig.docId !== ctx.doc.returnOfId ||
		orig.docType !== type ||
		orig.docStatus !== 'posted' ||
		orig.line.productId !== p.id
	) {
		refuse(`${p.name}: that is not a line of the document being returned.`);
	}
	const [{ already }] = await ctx.tx
		.select({ already: sql<number>`COALESCE(SUM(${stockDocumentLine.quantity}), 0)` })
		.from(stockDocumentLine)
		.innerJoin(stockDocument, eq(stockDocument.id, stockDocumentLine.documentId))
		.where(
			and(
				eq(stockDocumentLine.returnOfLineId, line.returnOfLineId!),
				eq(stockDocument.status, 'posted')
			)
		);
	const left = orig!.line.quantity - Number(already);
	if (line.quantity > left) {
		refuse(
			left <= 0
				? `${p.name}: all of it has already been returned.`
				: `${p.name}: only ${left} can still be returned.`
		);
	}
	return orig!;
}

/** A customer brings goods back: onto the shelf at the price-time cost, into the lot they left. */
async function returnToShelf(ctx: Ctx, line: Line, p: Product, to: Place) {
	const orig = await originalLine(ctx, line, p, 'issue');
	const buckets = await returnableLots(ctx, orig.docId, p.id);
	let left = line.quantity;
	for (const b of buckets) {
		if (left <= 0) break;
		const back = Math.min(b.qty, left);
		await move(ctx.tx, {
			productId: p.id,
			delta: back,
			reason: 'customer_return',
			locationId: to.id,
			lotId: b.lotId,
			unitCost: b.cost,
			refType: 'document',
			refId: ctx.doc.id,
			documentId: ctx.doc.id,
			docDate: ctx.doc.docDate,
			createdBy: ctx.actor.locals.user?.id ?? null
		});
		left -= back;
	}
	// Bucket bookkeeping is by lot, not by line; anything unmatched goes back lot-less.
	if (left > 0) {
		await move(ctx.tx, {
			productId: p.id,
			delta: left,
			reason: 'customer_return',
			locationId: to.id,
			unitCost: p.avgCost,
			refType: 'document',
			refId: ctx.doc.id,
			documentId: ctx.doc.id,
			docDate: ctx.doc.docDate,
			createdBy: ctx.actor.locals.user?.id ?? null
		});
	}
}

/** Goods go back to the supplier: out of the location, from the lot they came in on. */
async function returnToSupplier(ctx: Ctx, line: Line, p: Product, from: Place) {
	const orig = await originalLine(ctx, line, p, 'receipt');
	let lotId: number | null = null;
	if (orig.line.lotNumber) {
		const [lot] = await ctx.tx
			.select({ id: stockLot.id })
			.from(stockLot)
			.where(and(eq(stockLot.productId, p.id), eq(stockLot.lotNumber, orig.line.lotNumber)));
		lotId = lot?.id ?? null;
	}
	await move(ctx.tx, {
		productId: p.id,
		delta: -line.quantity,
		reason: 'supplier_return',
		locationId: from.id,
		lotId,
		allowUnusable: true,
		refType: 'document',
		refId: ctx.doc.id,
		documentId: ctx.doc.id,
		docDate: ctx.doc.docDate,
		createdBy: ctx.actor.locals.user?.id ?? null
	});
}

/**
 * The lots an original sale took a product from, less what earlier returns already put back, each
 * with the cost it left at. Read from the ledger, so it is what actually happened.
 */
async function returnableLots(ctx: Ctx, originalDocId: number, productId: number) {
	const sold = await ctx.tx
		.select({
			lotId: stockMovement.lotId,
			qty: sql<number>`-SUM(${stockMovement.delta})`,
			cost: sql<number>`MAX(${stockMovement.unitCost})`
		})
		.from(stockMovement)
		.where(and(eq(stockMovement.documentId, originalDocId), eq(stockMovement.productId, productId)))
		.groupBy(stockMovement.lotId)
		.orderBy(asc(stockMovement.lotId));
	const back = await ctx.tx
		.select({
			lotId: stockMovement.lotId,
			qty: sql<number>`SUM(${stockMovement.delta})`
		})
		.from(stockMovement)
		.innerJoin(stockDocument, eq(stockDocument.id, stockMovement.documentId))
		.where(
			and(
				eq(stockDocument.returnOfId, originalDocId),
				eq(stockDocument.status, 'posted'),
				eq(stockMovement.productId, productId)
			)
		)
		.groupBy(stockMovement.lotId);
	const returned = new Map(back.map((b) => [b.lotId ?? 0, Number(b.qty)]));
	return sold
		.map((s) => ({
			lotId: s.lotId,
			qty: Number(s.qty) - (returned.get(s.lotId ?? 0) ?? 0),
			cost: Number(s.cost)
		}))
		.filter((b) => b.qty > 0);
}

/**
 * Prices a sale: fixes each line's VAT rate and works out the document's subtotal, VAT and total.
 * Only documents whose lines carry prices are sales; an issue for internal use has none.
 */
async function priceSale(ctx: Ctx, lines: Line[], settings: Settings) {
	const priced = lines.filter((l) => l.unitPrice != null);
	if (!priced.length) return null;
	if (priced.length !== lines.length) refuse('Every line of a sale needs a price.');

	let vat = 0;
	const parts: number[] = [];
	for (const line of lines) {
		const p = ctx.products.get(line.productId)!;
		const rate = settings.vatRegistered && p.taxCode === 'standard' ? settings.vatRate : null;
		const amount = roundBirr(line.unitPrice! * line.quantity);
		parts.push(amount);
		if (rate) {
			vat += settings.pricesIncludeVat
				? roundBirr(vatWithin(amount, rate))
				: roundBirr((amount * rate) / 100);
		}
		await ctx.tx
			.update(stockDocumentLine)
			.set({ vatRate: rate, listPrice: line.listPrice ?? p.price })
			.where(eq(stockDocumentLine.id, line.id));
	}
	const sum = sumBirr(parts);
	const vatTotal = roundBirr(vat);
	return settings.pricesIncludeVat
		? { subtotal: roundBirr(sum - vatTotal), vatTotal, total: sum }
		: { subtotal: sum, vatTotal, total: roundBirr(sum + vatTotal) };
}
