import { and, asc, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { category, product, productImage } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';

/**
 * Cached public reads of the catalog (§6). Lists are tagged `catalog`; the dashboard's product,
 * category and image actions call `invalidate('catalog')`.
 *
 * Stock is read through the cache too, which is fine for showing "sold out": checkout re-reads
 * and locks every row before it takes anything (`orders.createFromCart`).
 */

const TTL = 60_000;

/** What the storefront may show: active, published, not deleted. */
const visible = () =>
	and(
		eq(product.isActive, true),
		isNotNull(product.publishedAt),
		lte(product.publishedAt, sql`NOW()`),
		notDeleted(product)
	);

export type ShopCategory = { id: number; slug: string; name: string; nameAm: string | null };

export function giftCategories(): Promise<ShopCategory[]> {
	return cached('catalog:gift-categories', { ttlMs: TTL, tags: ['catalog'] }, () =>
		db
			.select({
				id: category.id,
				slug: category.slug,
				name: category.name,
				nameAm: category.nameAm
			})
			.from(category)
			.where(and(eq(category.kind, 'gift'), eq(category.status, true), notDeleted(category)))
			.orderBy(asc(category.sortOrder), asc(category.name))
	);
}

export type ShopProduct = {
	id: number;
	slug: string;
	name: string;
	nameAm: string | null;
	description: string | null;
	descriptionAm: string | null;
	price: number;
	stockQty: number;
	categoryId: number;
	isFeatured: boolean;
	publishedAt: string;
	image: string | null;
	imageAlt: string | null;
};

/**
 * Every gift on sale, featured first, with its first image. The shop filters by category in the
 * browser, so this is one cached list rather than one per category — a gift shop's catalogue is
 * a few hundred rows at most, which is well under the page budget as JSON.
 */
export function giftProducts(): Promise<ShopProduct[]> {
	return cached('catalog:gift-products', { ttlMs: TTL, tags: ['catalog'] }, async () => {
		const rows = await db
			.select({
				id: product.id,
				slug: product.slug,
				name: product.name,
				nameAm: product.nameAm,
				description: product.description,
				descriptionAm: product.descriptionAm,
				price: product.price,
				stockQty: product.stockQty,
				categoryId: product.categoryId,
				isFeatured: product.isFeatured,
				publishedAt: product.publishedAt
			})
			.from(product)
			.innerJoin(category, and(eq(category.id, product.categoryId), notDeleted(category)))
			.where(and(eq(product.kind, 'gift'), isNotNull(product.price), visible()))
			.orderBy(desc(product.isFeatured), asc(product.sortOrder), desc(product.publishedAt));

		const images = await firstImages(rows.map((row) => row.id));

		return rows.map((row) => ({
			...row,
			price: row.price ?? 0,
			publishedAt: row.publishedAt!.toISOString(),
			image: images.get(row.id)?.fileName ?? null,
			imageAlt: images.get(row.id)?.alt ?? null
		}));
	});
}

/** The lowest-`sortOrder` image of each product, in one query (no N+1). */
async function firstImages(productIds: number[]) {
	const byProduct = new Map<number, { fileName: string; alt: string | null }>();
	if (!productIds.length) return byProduct;

	const rows = await db
		.select({
			productId: productImage.productId,
			fileName: productImage.fileName,
			alt: productImage.alt
		})
		.from(productImage)
		.where(and(inArray(productImage.productId, productIds), notDeleted(productImage)))
		.orderBy(asc(productImage.productId), asc(productImage.sortOrder), asc(productImage.id));

	for (const row of rows) {
		if (!byProduct.has(row.productId)) byProduct.set(row.productId, row);
	}
	return byProduct;
}
