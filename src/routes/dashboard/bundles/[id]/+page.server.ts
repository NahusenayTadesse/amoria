import { error } from '@sveltejs/kit';
import { and, asc, eq, max, ne } from 'drizzle-orm';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { bundle, bundleImage, bundleItem, category, product } from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import { photoGallery } from '$lib/server/photoGallery';
import {
	boxItems,
	bundleContents,
	bundleIssues,
	categoryPaths,
	containerRules,
	giftsById
} from '$lib/server/services/bundles';
import { bundleItemAdd, bundleItemEdit } from '$lib/schemas/catalog';
import { bundleFullPrice, bundlePrice, bundleStock, checkBox, type BoxProblem } from '$lib/bundle';

/** A rule broken, in staff words. */
function problemText(problem: BoxProblem, names: Map<number, string>, box: string) {
	if (problem.kind === 'not_allowed') {
		return `${names.get(problem.productId) ?? 'A gift'} does not go in ${box}: no rule lets it in.`;
	}
	return problem.kind === 'too_many'
		? `${box} holds at most ${problem.rule.maxQty} ${problem.rule.name}; this has ${problem.count}.`
		: `${box} needs at least ${problem.rule.minQty} ${problem.rule.name}; this has ${problem.count}.`;
}

function bundleId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Bundle not found');
	return id;
}

/** Photos: the main one (the bundle's card and the top of its sheet) and the gallery. */
const images = photoGallery({
	table: bundleImage,
	ownerColumn: 'bundleId',
	permission: 'catalog.manage',
	audit: 'bundle_image'
});

/**
 * The gifts in a bundle: the kit's owner-scoped child CRUD. Only gifts that are for sale can go
 * in, each once; a second "add" of the same gift is refused with a pointer to its row.
 */
const items = childCrud({
	table: bundleItem,
	ownerColumn: 'bundleId',
	label: 'Gift',
	addSchema: bundleItemAdd,
	editSchema: bundleItemEdit,
	permission: 'catalog.manage',
	audit: 'bundle_item',
	transform: async (values, event, before) => {
		const owner = bundleId(event.params);
		const productId = Number(values.productId);
		const [self] = await db
			.select({ type: bundle.type, containerId: bundle.containerId })
			.from(bundle)
			.where(eq(bundle.id, owner));
		if (self?.type === 'custom') {
			throw new WriteRefused(null, 'Customers choose what goes in this bundle.');
		}
		const [gift] = await db
			.select({ name: product.name, kind: product.kind, price: product.price })
			.from(product)
			.where(and(eq(product.id, productId), notDeleted(product)));
		if (!gift || gift.kind !== 'gift' || gift.price === null) {
			throw new WriteRefused('productId', 'Choose a gift with a price: only gifts are sold.');
		}
		const [twice] = await db
			.select({ id: bundleItem.id })
			.from(bundleItem)
			.where(
				and(
					eq(bundleItem.bundleId, owner),
					eq(bundleItem.productId, productId),
					notDeleted(bundleItem),
					before ? ne(bundleItem.id, Number(before.id)) : undefined
				)
			);
		if (twice) {
			throw new WriteRefused(
				'productId',
				`${gift.name} is already in this bundle. Change how many on its row instead.`
			);
		}
		// In a container, the gifts must fit it: nothing it does not take, nothing over a limit.
		// Falling short of a minimum is allowed while the bundle is being filled; the page says so.
		if (self?.containerId) {
			const current = (await bundleContents([{ id: owner, containerId: null }])).get(owner) ?? [];
			const next = [
				...current.filter(
					(part) => part.productId !== productId && part.productId !== before?.productId
				),
				{ productId, qty: Number(values.qty) }
			];
			const [gifts, rules, paths] = await Promise.all([
				giftsById([...next.map((part) => part.productId), self.containerId]),
				containerRules([self.containerId]),
				categoryPaths()
			]);
			const items = boxItems(
				next.map((part) => ({ ...part, categoryId: gifts.get(part.productId)?.categoryId ?? 0 })),
				paths
			);
			const box = gifts.get(self.containerId)?.name ?? 'The container';
			const names = new Map([...gifts].map(([id, g]) => [id, g.name]));
			const problem = checkBox(rules.get(self.containerId) ?? [], items).find(
				(p) => p.kind !== 'too_few'
			);
			if (problem) throw new WriteRefused('qty', problemText(problem, names, box));
		}
		if (before) return { ...values, sortOrder: before.sortOrder };
		// A new gift goes after the ones already there.
		const [{ last }] = await db
			.select({ last: max(bundleItem.sortOrder) })
			.from(bundleItem)
			.where(and(eq(bundleItem.bundleId, owner), notDeleted(bundleItem)));
		return { ...values, sortOrder: (last ?? -1) + 1 };
	}
});

export const load = async ({ params, locals }) => {
	const id = bundleId(params);
	const [row] = await db
		.select({ bundle, categoryName: category.name })
		.from(bundle)
		.leftJoin(category, eq(category.id, bundle.categoryId))
		.where(and(eq(bundle.id, id), notDeleted(bundle)));
	if (!row) error(404, 'Bundle not found');
	const b = row.bundle;
	const custom = b.type === 'custom';

	const [itemPage, contents, rules, paths, gifts, photos] = await Promise.all([
		items.load(id),
		bundleContents([b]),
		containerRules(b.containerId ? [b.containerId] : []),
		categoryPaths(),
		db
			.select({ value: product.id, name: product.name, price: product.price })
			.from(product)
			.where(and(eq(product.kind, 'gift'), eq(product.isActive, true), notDeleted(product)))
			.orderBy(asc(product.name)),
		images.load(id)
	]);

	const parts = contents.get(id) ?? [];
	const container = parts.find((part) => part.isContainer) ?? null;
	const byProduct = new Map(
		parts.filter((part) => !part.isContainer).map((part) => [part.productId, part])
	);
	const boxRules = b.containerId ? (rules.get(b.containerId) ?? []) : [];
	const { offSale, problems } = bundleIssues(parts, b.containerId ? boxRules : undefined, paths);
	const names = new Map(parts.map((part) => [part.productId, part.name]));
	const full = bundleFullPrice(parts);
	const price = bundlePrice(parts, b.discountPercent);

	return {
		bundle: b,
		categoryName: row.categoryName,
		container: container && {
			id: container.productId,
			name: container.name,
			price: container.price,
			stockQty: container.stockQty,
			rules: boxRules.map((rule) => ({
				id: rule.id,
				name: rule.name,
				about: rule.productId ? 'gift' : 'category',
				minQty: rule.minQty,
				maxQty: rule.maxQty
			}))
		},
		summary: {
			full,
			price,
			saving: Math.round((full - price) * 100) / 100,
			sets: offSale.length || problems.length ? 0 : bundleStock(parts),
			offSale,
			// A box customers fill is checked when they fill it, not here.
			problems: custom
				? []
				: problems.map((problem) => problemText(problem, names, container?.name ?? 'The container'))
		},
		itemSection: custom
			? null
			: {
					addForm: itemPage.addForm,
					editForm: itemPage.editForm,
					// The kit's rows carry the raw columns; the section shows the gift's name, price and stock.
					rows: (itemPage.rows as unknown as { id: number; productId: number; qty: number }[]).map(
						(item) => {
							const part = byProduct.get(item.productId);
							return {
								...item,
								product: part?.name ?? '—',
								price: part ? part.price : null,
								lineTotal: part ? Math.round(part.price * item.qty * 100) / 100 : null,
								stockQty: part?.stockQty ?? 0
							};
						}
					)
				},
		giftOptions: gifts
			.filter((gift) => gift.price !== null)
			.map((gift) => ({ value: gift.value, name: gift.name })),
		images: photos,
		isSuperAdmin: locals.isSuperAdmin
	};
};

/** What is in a bundle changes its price and stock on the shop. */
const touched = <T>(result: T) => {
	invalidate('catalog');
	return result;
};

export const actions = {
	addItem: async (event) => touched(await items.actions.add(event, bundleId(event.params))),
	editItem: async (event) => touched(await items.actions.edit(event, bundleId(event.params))),
	deleteItem: async (event) => touched(await items.actions.delete(event, bundleId(event.params))),

	addPhotos: async (event) => images.actions.addPhotos(event, bundleId(event.params)),
	editPhoto: async (event) => images.actions.editPhoto(event, bundleId(event.params)),
	deletePhoto: async (event) => images.actions.deletePhoto(event, bundleId(event.params)),
	movePhoto: async (event) => images.actions.movePhoto(event, bundleId(event.params))
};
