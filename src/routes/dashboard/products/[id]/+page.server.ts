import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, max, ne, sql } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import {
	bundle,
	category,
	containerRule,
	location,
	orderItem,
	orders,
	product,
	productImage,
	stockBalance,
	stockLot,
	stockMovement,
	supplier,
	user
} from '$lib/server/db/schema';
import { locationOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { adjustStock } from '$lib/server/services/stock';
import { getSettings } from '$lib/server/services/settings';
import { photoGallery } from '$lib/server/photoGallery';
import { stockAdjustSchema } from '$lib/schemas/dashboard';
import { containerRuleAdd, containerRuleEdit } from '$lib/schemas/catalog';
import { invalidate } from '$lib/server/cache';
import type { StockReason } from '$lib/stock';

/** Photos: the main one and the gallery (`$lib/server/photoGallery`), scoped to this product. */
const images = photoGallery({
	table: productImage,
	ownerColumn: 'productId',
	permission: 'catalog.manage',
	audit: 'product_image'
});

/**
 * What fits in this gift when it is used as a box, basket or wrap (§5.2): a rule per category
 * or per gift. A gift with rules is a container, offered to bundles.
 */
const rules = childCrud({
	table: containerRule,
	ownerColumn: 'containerId',
	label: 'Rule',
	addSchema: containerRuleAdd,
	editSchema: containerRuleEdit,
	permission: 'catalog.manage',
	audit: 'container_rule',
	transform: async (values, event, before) => {
		const owner = productId(event.params as { id: string });
		const [self] = await db
			.select({ kind: product.kind })
			.from(product)
			.where(eq(product.id, owner));
		if (self?.kind !== 'gift') {
			throw new WriteRefused(null, 'Only a gift can be a container.');
		}
		const categoryId = values.categoryId ? Number(values.categoryId) : null;
		const giftId = values.productId ? Number(values.productId) : null;
		if (categoryId) {
			const [cat] = await db
				.select({ kind: category.kind })
				.from(category)
				.where(and(eq(category.id, categoryId), notDeleted(category)));
			if (cat?.kind !== 'gift') throw new WriteRefused('categoryId', 'Choose a gift category');
		}
		if (giftId) {
			if (giftId === owner) throw new WriteRefused('productId', 'A container cannot hold itself.');
			const [gift] = await db
				.select({ kind: product.kind })
				.from(product)
				.where(and(eq(product.id, giftId), notDeleted(product)));
			if (gift?.kind !== 'gift') throw new WriteRefused('productId', 'Choose a gift');
		}
		const [twice] = await db
			.select({ id: containerRule.id })
			.from(containerRule)
			.where(
				and(
					eq(containerRule.containerId, owner),
					categoryId
						? eq(containerRule.categoryId, categoryId)
						: eq(containerRule.productId, giftId!),
					notDeleted(containerRule),
					before ? ne(containerRule.id, Number(before.id)) : undefined
				)
			);
		if (twice) {
			throw new WriteRefused(
				categoryId ? 'categoryId' : 'productId',
				'There is already a rule for that. Change the one that is there.'
			);
		}
		let sortOrder = before?.sortOrder;
		if (sortOrder === undefined) {
			const [{ last }] = await db
				.select({ last: max(containerRule.sortOrder) })
				.from(containerRule)
				.where(and(eq(containerRule.containerId, owner), notDeleted(containerRule)));
			sortOrder = (last ?? -1) + 1;
		}
		return { ...values, categoryId, productId: giftId, sortOrder };
	}
});

function productId(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Product not found');
	return id;
}

export const load = async ({ params, locals }) => {
	const id = productId(params);
	const [row] = await db
		.select({ product, categoryName: category.name })
		.from(product)
		.leftJoin(category, eq(category.id, product.categoryId))
		.where(eq(product.id, id));
	if (!row) error(404, 'Product not found');

	const [imagePage, movements, [held], settings, balances, locations, [main]] = await Promise.all([
		images.load(id),
		db
			.select({
				id: stockMovement.id,
				delta: stockMovement.delta,
				reason: stockMovement.reason,
				refType: stockMovement.refType,
				refId: stockMovement.refId,
				note: stockMovement.note,
				createdAt: stockMovement.createdAt,
				location: location.name,
				lot: stockLot.lotNumber,
				unitCost: stockMovement.unitCost,
				by: user.name
			})
			.from(stockMovement)
			.innerJoin(location, eq(location.id, stockMovement.locationId))
			.leftJoin(stockLot, eq(stockLot.id, stockMovement.lotId))
			.leftJoin(user, eq(user.id, stockMovement.createdBy))
			.where(eq(stockMovement.productId, id))
			.orderBy(desc(stockMovement.id))
			.limit(100),
		// Units already taken out of `stockQty` for orders that are not paid yet — may come back.
		db
			.select({ qty: sql<string>`COALESCE(SUM(${orderItem.qty}), 0)` })
			.from(orderItem)
			.innerJoin(orders, eq(orders.id, orderItem.orderId))
			.where(and(eq(orderItem.productId, id), eq(orders.status, 'pending_payment'))),
		getSettings(),
		// Where every unit is: by location, and by lot where the product has them.
		db
			.select({
				location: location.name,
				kind: location.kind,
				lot: stockLot.lotNumber,
				expiryDate: stockLot.expiryDate,
				lotStatus: stockLot.status,
				quantity: stockBalance.quantity
			})
			.from(stockBalance)
			.innerJoin(location, eq(location.id, stockBalance.locationId))
			.leftJoin(stockLot, eq(stockLot.id, stockBalance.lotId))
			.where(and(eq(stockBalance.productId, id), sql`${stockBalance.quantity} <> 0`))
			.orderBy(asc(location.sortOrder), asc(stockLot.expiryDate)),
		locationOptions({ withQuarantine: true }),
		row.product.mainSupplierId
			? db
					.select({ name: supplier.name })
					.from(supplier)
					.where(eq(supplier.id, row.product.mainSupplierId))
			: Promise.resolve([{ name: null }])
	]);

	const isGift = row.product.kind === 'gift';
	const [rulePage, giftCategories, gifts, usedBy] = isGift
		? await Promise.all([
				rules.load(id),
				db
					.select({ value: category.id, name: category.name })
					.from(category)
					.where(and(eq(category.kind, 'gift'), notDeleted(category)))
					.orderBy(asc(category.sortOrder), asc(category.name)),
				db
					.select({ value: product.id, name: product.name })
					.from(product)
					.where(and(eq(product.kind, 'gift'), ne(product.id, id), notDeleted(product)))
					.orderBy(asc(product.name)),
				db
					.select({ id: bundle.id, name: bundle.name, type: bundle.type })
					.from(bundle)
					.where(and(eq(bundle.containerId, id), notDeleted(bundle)))
					.orderBy(asc(bundle.name))
			])
		: [null, [], [], []];
	const categoryName = new Map(giftCategories.map((c) => [c.value, c.name]));
	const giftName = new Map(gifts.map((g) => [g.value, g.name]));

	return {
		container: rulePage
			? {
					addForm: rulePage.addForm,
					editForm: rulePage.editForm,
					// The kit's rows carry the raw columns; the section shows what each rule is about.
					rows: (
						rulePage.rows as unknown as {
							id: number;
							categoryId: number | null;
							productId: number | null;
						}[]
					).map((r) => ({
						...r,
						category: r.categoryId ? (categoryName.get(r.categoryId) ?? '—') : '',
						gift: r.productId ? (giftName.get(r.productId) ?? '—') : ''
					})),
					options: { categoryId: giftCategories, productId: gifts },
					usedBy
				}
			: null,
		product: row.product,
		categoryName: row.categoryName,
		heldForUnpaid: Number(held?.qty ?? 0),
		balances,
		locations,
		mainSupplier: main?.name ?? null,
		lowStockAt: row.product.lowStockThreshold ?? settings.lowStockDefault,
		images: imagePage,
		movements,
		can: { adjust: hasPermission(locals, 'stock.adjust') },
		adjustForm: await superValidate(zod4(stockAdjustSchema))
	};
};

/** A rule changes what the shop's boxes may hold. */
const touched = <T>(result: T) => {
	invalidate('catalog');
	return result;
};

export const actions = {
	addRule: async (event) => touched(await rules.actions.add(event, productId(event.params))),
	editRule: async (event) => touched(await rules.actions.edit(event, productId(event.params))),
	deleteRule: async (event) => touched(await rules.actions.delete(event, productId(event.params))),

	addPhotos: async (event) => images.actions.addPhotos(event, productId(event.params)),
	editPhoto: async (event) => images.actions.editPhoto(event, productId(event.params)),
	deletePhoto: async (event) => images.actions.deletePhoto(event, productId(event.params)),
	movePhoto: async (event) => images.actions.movePhoto(event, productId(event.params)),

	/** A delivery, damage, a loss, or a stock count (`stock.adjustStock`). */
	adjust: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const form = await superValidate(event.request, zod4(stockAdjustSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the quantity.' }, { status: 400 });

		const { mode, reason, qty, counted, note, locationId } = form.data;
		try {
			await adjustStock(
				productId(event.params),
				mode === 'count'
					? { mode: 'count', counted, note: note || null, locationId }
					: { mode: 'move', reason: reason as StockReason, qty, note: note || null, locationId },
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Stock updated' });
	}
};
