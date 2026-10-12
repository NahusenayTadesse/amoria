import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { bundleItem, category, containerRule, product } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';
import { checkBox, type BoxItem, type BoxProblem, type BoxRule } from '$lib/bundle';

/**
 * Reads behind bundles (§5.2): what is in each, what fits in each container, and whether a
 * bundle can be sold as it stands. Shared by the shop's cached list and the dashboard; checkout
 * re-reads under lock in `orders.createFromCart`.
 */

/** One gift in a bundle, the container first, with its current price and stock. */
export type BundlePartRow = {
	productId: number;
	name: string;
	nameAm: string | null;
	qty: number;
	price: number;
	stockQty: number;
	categoryId: number;
	/** An active, priced gift that is not removed. Need not be on the shop by itself. */
	sellable: boolean;
	isContainer: boolean;
};

/** Gifts by id, with what a bundle needs to know about each. */
export async function giftsById(ids: number[]) {
	const rows = ids.length
		? await db
				.select({
					id: product.id,
					name: product.name,
					nameAm: product.nameAm,
					price: product.price,
					stockQty: product.stockQty,
					categoryId: product.categoryId,
					kind: product.kind,
					isActive: product.isActive,
					deletedAt: product.deletedAt
				})
				.from(product)
				.where(inArray(product.id, [...new Set(ids)]))
		: [];
	return new Map(
		rows.map((row) => [
			row.id,
			{
				...row,
				price: row.price ?? 0,
				sellable:
					row.kind === 'gift' && row.isActive && row.price !== null && row.deletedAt === null
			}
		])
	);
}

/**
 * Each bundle's parts in order: its container (if it has one), then the gifts staff put in it.
 * A `custom` bundle has only its container here; the customer chooses the rest.
 */
export async function bundleContents(bundles: { id: number; containerId: number | null }[]) {
	const byBundle = new Map<number, BundlePartRow[]>();
	if (!bundles.length) return byBundle;

	const items = await db
		.select({
			bundleId: bundleItem.bundleId,
			productId: bundleItem.productId,
			qty: bundleItem.qty
		})
		.from(bundleItem)
		.where(
			and(
				inArray(
					bundleItem.bundleId,
					bundles.map((b) => b.id)
				),
				notDeleted(bundleItem)
			)
		)
		.orderBy(asc(bundleItem.bundleId), asc(bundleItem.sortOrder), asc(bundleItem.id));

	const gifts = await giftsById([
		...items.map((item) => item.productId),
		...bundles.flatMap((b) => (b.containerId ? [b.containerId] : []))
	]);
	const part = (productId: number, qty: number, isContainer: boolean): BundlePartRow[] => {
		const gift = gifts.get(productId);
		if (!gift) return [];
		const { name, nameAm, price, stockQty, categoryId, sellable } = gift;
		return [{ productId, name, nameAm, qty, price, stockQty, categoryId, sellable, isContainer }];
	};

	for (const b of bundles) {
		byBundle.set(b.id, [
			...(b.containerId ? part(b.containerId, 1, true) : []),
			...items
				.filter((item) => item.bundleId === b.id)
				.flatMap((item) => part(item.productId, item.qty, false))
		]);
	}
	return byBundle;
}

/** Every container's rules in order, named after the category or gift each one is about. */
export async function containerRules(containerIds: number[]) {
	const byContainer = new Map<number, BoxRule[]>();
	if (!containerIds.length) return byContainer;

	const rows = await db
		.select({
			id: containerRule.id,
			containerId: containerRule.containerId,
			categoryId: containerRule.categoryId,
			productId: containerRule.productId,
			minQty: containerRule.minQty,
			maxQty: containerRule.maxQty,
			categoryName: category.name,
			categoryNameAm: category.nameAm,
			productName: product.name,
			productNameAm: product.nameAm
		})
		.from(containerRule)
		.leftJoin(category, eq(category.id, containerRule.categoryId))
		.leftJoin(product, eq(product.id, containerRule.productId))
		.where(
			and(
				inArray(containerRule.containerId, [...new Set(containerIds)]),
				isNull(containerRule.deletedAt)
			)
		)
		.orderBy(asc(containerRule.sortOrder), asc(containerRule.id));

	for (const row of rows) {
		const list = byContainer.get(row.containerId) ?? [];
		list.push({
			id: row.id,
			categoryId: row.categoryId,
			productId: row.productId,
			minQty: row.minQty,
			maxQty: row.maxQty,
			name: row.categoryName ?? row.productName ?? '',
			nameAm: row.categoryNameAm ?? row.productNameAm
		});
		byContainer.set(row.containerId, list);
	}
	return byContainer;
}

/**
 * Each category with every parent above it, so a rule about "Flowers" also lets in a gift
 * filed under "Flowers › Roses". Cached with the catalog; a few dozen rows.
 */
export function categoryPaths(): Promise<Map<number, number[]>> {
	return cached('catalog:category-paths', { ttlMs: 60_000, tags: ['catalog'] }, async () => {
		const rows = await db.select({ id: category.id, parentId: category.parentId }).from(category);
		const parent = new Map(rows.map((row) => [row.id, row.parentId]));
		return new Map(
			rows.map((row) => {
				const path: number[] = [];
				// Bounded by the number of categories, so a loop in the data cannot hang it.
				for (let at: number | null = row.id; at !== null && path.length <= rows.length;) {
					path.push(at);
					at = parent.get(at) ?? null;
				}
				return [row.id, path];
			})
		);
	});
}

/** Gifts as a container's rules see them. */
export function boxItems(
	parts: { productId: number; categoryId: number; qty: number }[],
	paths: Map<number, number[]>
): BoxItem[] {
	return parts.map((part) => ({
		productId: part.productId,
		qty: part.qty,
		categoryIds: paths.get(part.categoryId) ?? [part.categoryId]
	}));
}

/**
 * Why a bundle cannot be sold as it stands, for the dashboard: a gift off sale, or (for a staff
 * bundle in a container) contents the container's rules do not allow. Empty means it can.
 */
export function bundleIssues(
	parts: BundlePartRow[],
	rules: BoxRule[] | undefined,
	paths: Map<number, number[]>
): { offSale: string[]; problems: BoxProblem[] } {
	const container = parts.find((part) => part.isContainer);
	return {
		offSale: parts.filter((part) => !part.sellable).map((part) => part.name),
		problems: container
			? checkBox(
					rules ?? [],
					boxItems(
						parts.filter((part) => !part.isContainer),
						paths
					)
				)
			: []
	};
}
