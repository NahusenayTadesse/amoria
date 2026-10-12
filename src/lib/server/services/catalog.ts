import { and, asc, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { bundle, bundleImage, category, product, productImage } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';
import {
	boxFromPrice,
	bundleFullPrice,
	bundlePrice,
	bundleStock,
	rulesFor,
	type BoxChoice,
	type BoxOffer
} from '$lib/bundle';
import { bundleContents, bundleIssues, categoryPaths, containerRules } from './bundles';

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
	/** `product` or `bundle`: the two live in different tables, so their ids can repeat. */
	kind: 'product' | 'bundle';
	id: number;
	/** Unique across both kinds (`p12`, `b3`): what the bag and the page's sheet key on. */
	key: string;
	slug: string;
	name: string;
	nameAm: string | null;
	description: string | null;
	descriptionAm: string | null;
	price: number;
	stockQty: number;
	categoryId: number | null;
	isFeatured: boolean;
	publishedAt: string;
	image: string | null;
	imageAlt: string | null;
	/** Every photo, in order, for the product sheet's gallery (the first is `image`). */
	gallery: { fileName: string; alt: string | null }[];
	/** A bundle's contents, and the price they would cost one by one. Null for a product. */
	bundle: {
		/** What is in it, the container first. A box the customer builds lists only its container. */
		items: { name: string; nameAm: string | null; qty: number }[];
		/** For a built box, the least it can cost undiscounted; `price` is then "from". */
		fullPrice: number;
		discountPercent: number;
		/** A build-your-own box: what the customer may put in it. Null for a staff bundle. */
		custom: BoxOffer | null;
	} | null;
};

/**
 * Every gift and bundle on sale, featured first, with its first image. The shop filters by
 * category in the browser, so this is one cached list rather than one per category — a gift
 * shop's catalogue is a few hundred rows at most, which is well under the page budget as JSON.
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
				publishedAt: product.publishedAt,
				sortOrder: product.sortOrder
			})
			.from(product)
			.innerJoin(category, and(eq(category.id, product.categoryId), notDeleted(category)))
			.where(and(eq(product.kind, 'gift'), isNotNull(product.price), visible()));

		const { byProduct: images, gallery } = await firstImages(rows.map((row) => row.id));

		const products = rows.map((row) => ({
			kind: 'product' as const,
			...row,
			key: `p${row.id}`,
			price: row.price ?? 0,
			publishedAt: row.publishedAt!,
			image: images.get(row.id)?.fileName ?? null,
			imageAlt: images.get(row.id)?.alt ?? null,
			gallery: gallery.get(row.id) ?? [],
			bundle: null
		}));

		const all = [...products, ...(await shopBundles())].sort(
			(a, b) =>
				Number(b.isFeatured) - Number(a.isFeatured) ||
				a.sortOrder - b.sortOrder ||
				b.publishedAt.getTime() - a.publishedAt.getTime()
		);
		return all.map((item) => ({
			...item,
			publishedAt: item.publishedAt.toISOString()
		}));
	});
}

/**
 * Bundles on sale, priced and counted from their contents. A bundle with a gift that is no longer
 * sold (switched off, removed, priceless), or whose contents break its container's rules, is
 * left off the shop rather than sold short. A build-your-own box needs its container in stock
 * and at least one gift a customer could put in it.
 */
async function shopBundles() {
	const rows = await db
		.select({
			id: bundle.id,
			slug: bundle.slug,
			name: bundle.name,
			nameAm: bundle.nameAm,
			description: bundle.description,
			descriptionAm: bundle.descriptionAm,
			type: bundle.type,
			containerId: bundle.containerId,
			discountPercent: bundle.discountPercent,
			categoryId: bundle.categoryId,
			isFeatured: bundle.isFeatured,
			publishedAt: bundle.publishedAt,
			sortOrder: bundle.sortOrder
		})
		.from(bundle)
		.where(
			and(
				eq(bundle.isActive, true),
				isNotNull(bundle.publishedAt),
				lte(bundle.publishedAt, sql`NOW()`),
				notDeleted(bundle)
			)
		);
	if (!rows.length) return [];

	const ids = rows.map((row) => row.id);
	const containerIds = rows.flatMap((row) => (row.containerId ? [row.containerId] : []));
	const [parts, rules, paths, photos] = await Promise.all([
		bundleContents(rows),
		containerRules(containerIds),
		categoryPaths(),
		db
			.select({
				bundleId: bundleImage.bundleId,
				fileName: bundleImage.fileName,
				alt: bundleImage.alt
			})
			.from(bundleImage)
			.where(and(inArray(bundleImage.bundleId, ids), notDeleted(bundleImage)))
			.orderBy(asc(bundleImage.bundleId), asc(bundleImage.sortOrder), asc(bundleImage.id))
	]);
	const choices = rows.some((row) => row.type === 'custom') ? await boxChoices() : [];

	return rows.flatMap((row) => {
		const contents = parts.get(row.id) ?? [];
		const container = contents.find((part) => part.isContainer);
		const { offSale, problems } = bundleIssues(
			contents,
			row.containerId ? rules.get(row.containerId) : undefined,
			paths
		);
		if (offSale.length) return [];

		let custom: BoxOffer | null = null;
		let price: number;
		let fullPrice: number;
		let stockQty: number;
		if (row.type === 'custom') {
			const boxRules = rules.get(row.containerId ?? 0) ?? [];
			if (!container || !boxRules.length) return [];
			custom = {
				container: {
					productId: container.productId,
					name: container.name,
					nameAm: container.nameAm,
					price: container.price
				},
				rules: boxRules,
				choices: choices.filter(
					(c) => c.productId !== container.productId && rulesFor(boxRules, c).length
				)
			};
			if (!custom.choices.length) return [];
			price = boxFromPrice(custom, row.discountPercent);
			fullPrice = boxFromPrice(custom, 0);
			stockQty = container.stockQty;
		} else {
			if (!contents.length || problems.length) return [];
			price = bundlePrice(contents, row.discountPercent);
			fullPrice = bundleFullPrice(contents);
			stockQty = bundleStock(contents);
		}

		const gallery = photos
			.filter((photo) => photo.bundleId === row.id)
			.map(({ fileName, alt }) => ({ fileName, alt }));
		return [
			{
				kind: 'bundle' as const,
				id: row.id,
				key: `b${row.id}`,
				slug: row.slug,
				name: row.name,
				nameAm: row.nameAm,
				description: row.description,
				descriptionAm: row.descriptionAm,
				price,
				stockQty,
				categoryId: row.categoryId,
				isFeatured: row.isFeatured,
				publishedAt: row.publishedAt!,
				sortOrder: row.sortOrder,
				image: gallery[0]?.fileName ?? null,
				imageAlt: gallery[0]?.alt ?? null,
				gallery,
				bundle: {
					items: contents.map(({ name, nameAm, qty }) => ({ name, nameAm, qty })),
					fullPrice,
					discountPercent: row.discountPercent,
					custom
				}
			}
		];
	});
}

/**
 * Gifts a customer could put in a box: for sale, in stock, with their first photo. Each box
 * keeps the ones its rules let in. Need not be on the shop by themselves.
 */
async function boxChoices(): Promise<BoxChoice[]> {
	const [rows, paths] = await Promise.all([
		db
			.select({
				productId: product.id,
				name: product.name,
				nameAm: product.nameAm,
				price: product.price,
				stockQty: product.stockQty,
				categoryId: product.categoryId
			})
			.from(product)
			.where(
				and(
					eq(product.kind, 'gift'),
					eq(product.isActive, true),
					isNotNull(product.price),
					gt(product.stockQty, 0),
					notDeleted(product)
				)
			)
			.orderBy(asc(product.sortOrder), asc(product.name)),
		categoryPaths()
	]);
	const { byProduct } = await firstImages(rows.map((row) => row.productId));
	return rows.map(({ categoryId, ...row }) => ({
		...row,
		price: row.price ?? 0,
		image: byProduct.get(row.productId)?.fileName ?? null,
		categoryIds: paths.get(categoryId) ?? [categoryId]
	}));
}

/** Each product's images in order, in one query (no N+1); the first is its cover. */
async function firstImages(productIds: number[]) {
	const byProduct = new Map<number, { fileName: string; alt: string | null }>();
	const gallery = new Map<number, { fileName: string; alt: string | null }[]>();
	if (!productIds.length) return { byProduct, gallery };

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
		const list = gallery.get(row.productId) ?? [];
		list.push({ fileName: row.fileName, alt: row.alt });
		gallery.set(row.productId, list);
	}
	return { byProduct, gallery };
}
