import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { category, product, stockDocument } from '$lib/server/db/schema';
import { attempt } from '$lib/server/attempt';
import { assignBarcodes } from '$lib/server/services/inventory/barcodes';

/** Pick products to print shelf labels for, or everything that came in on a delivery. */
export const load = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	const [products, deliveries, [{ missing }]] = await Promise.all([
		db
			.select({
				id: product.id,
				name: product.name,
				sku: product.sku,
				barcode: product.barcode,
				price: product.price,
				category: category.name
			})
			.from(product)
			.leftJoin(category, eq(category.id, product.categoryId))
			.where(
				and(
					sql`${product.deletedAt} IS NULL`,
					q
						? or(
								like(product.name, `%${q}%`),
								like(product.sku, `%${q}%`),
								like(product.barcode, `%${q}%`)
							)
						: undefined
				)
			)
			.orderBy(asc(product.name))
			.limit(300),
		db
			.select({
				id: stockDocument.id,
				number: stockDocument.number,
				docDate: stockDocument.docDate
			})
			.from(stockDocument)
			.where(and(eq(stockDocument.type, 'receipt'), eq(stockDocument.status, 'posted')))
			.orderBy(desc(stockDocument.id))
			.limit(20),
		db
			.select({ missing: sql<number>`COUNT(*)` })
			.from(product)
			.where(and(sql`${product.deletedAt} IS NULL`, sql`${product.barcode} IS NULL`))
	]);
	return { products, deliveries, missing: Number(missing), q };
};

export const actions = {
	assign: async () =>
		attempt(async () => {
			const given = await assignBarcodes();
			return { given };
		}, 'Barcodes given')
};
