/**
 * Barcodes and labels. Products without a barcode of their own get an in-store EAN-13
 * (`$lib/barcode`), never one another product already has; labels print those (or the SKU) as SVG
 * from bwip-js, a pure-JavaScript renderer, so the server needs no native library.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { toSVG } from 'bwip-js/node';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { category, product, stockDocumentLine } from '$lib/server/db/schema';
import { inStoreBarcode, isValidEan13 } from '$lib/barcode';

/** Gives every live product without a barcode its in-store code. Returns how many were given. */
export async function assignBarcodes(): Promise<number> {
	return transaction(async (tx) => {
		const missing = await tx
			.select({ id: product.id })
			.from(product)
			.where(and(sql`${product.deletedAt} IS NULL`, sql`${product.barcode} IS NULL`))
			.orderBy(asc(product.id))
			.for('update');
		if (!missing.length) return 0;
		const codes = missing.map((p) => ({ id: p.id, code: inStoreBarcode(p.id) }));
		// A product may already carry a manufacturer code that equals one of ours: skip those.
		const taken = new Set(
			(
				await tx
					.select({ barcode: product.barcode })
					.from(product)
					.where(
						inArray(
							product.barcode,
							codes.map((c) => c.code)
						)
					)
			).map((r) => r.barcode)
		);
		let given = 0;
		for (const c of codes) {
			if (taken.has(c.code)) continue;
			await tx.update(product).set({ barcode: c.code }).where(eq(product.id, c.id));
			given += 1;
		}
		return given;
	});
}

/** The barcode as SVG: EAN-13 when the code is one, else Code 128. Empty text gives no image. */
export function barcodeSvg(text: string, height = 12): string {
	if (!text) return '';
	return toSVG({
		bcid: isValidEan13(text) ? 'ean13' : 'code128',
		text,
		height,
		includetext: true,
		textxalign: 'center'
	});
}

export type Label = {
	id: number;
	name: string;
	nameAm: string | null;
	sku: string | null;
	category: string | null;
	price: number | null;
	barcode: string;
	svg: string;
};

/** Label data for chosen products, or for everything on a delivery. Products without a barcode print their SKU. */
export async function labelsFor(
	source: { productIds: number[] } | { documentId: number }
): Promise<Label[]> {
	const ids =
		'documentId' in source
			? (
					await db
						.selectDistinct({ id: stockDocumentLine.productId })
						.from(stockDocumentLine)
						.where(eq(stockDocumentLine.documentId, source.documentId))
				).map((r) => r.id)
			: source.productIds;
	if (!ids.length) return [];
	const rows = await db
		.select({
			id: product.id,
			name: product.name,
			nameAm: product.nameAm,
			sku: product.sku,
			barcode: product.barcode,
			price: product.price,
			category: category.name
		})
		.from(product)
		.leftJoin(category, eq(category.id, product.categoryId))
		.where(and(inArray(product.id, ids), sql`${product.deletedAt} IS NULL`))
		.orderBy(asc(product.name));
	return rows.map((r) => {
		const code = r.barcode ?? r.sku ?? '';
		return { ...r, barcode: code, svg: barcodeSvg(code) };
	});
}
