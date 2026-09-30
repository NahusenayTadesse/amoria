import { error } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import {
	category,
	orderItem,
	orders,
	product,
	productImage,
	stockMovement,
	user
} from '$lib/server/db/schema';
import { adjustStock } from '$lib/server/services/stock';
import { getSettings } from '$lib/server/services/settings';
import { invalidate } from '$lib/server/cache';
import { imageAdd, imageEdit } from '$lib/schemas/catalog';
import { stockAdjustSchema } from '$lib/schemas/dashboard';
import type { StockReason } from '$lib/stock';

/** Photos: the kit's owner-scoped child CRUD — reads, writes and deletes only this product's rows. */
const images = childCrud({
	table: productImage,
	ownerColumn: 'productId',
	label: 'Photo',
	addSchema: imageAdd,
	editSchema: imageEdit,
	fileFields: ['fileName'],
	permission: 'catalog.manage',
	audit: 'product_image'
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

	const [imagePage, movements, [held], settings] = await Promise.all([
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
				by: user.name
			})
			.from(stockMovement)
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
		getSettings()
	]);

	return {
		product: row.product,
		categoryName: row.categoryName,
		heldForUnpaid: Number(held?.qty ?? 0),
		lowStockAt: row.product.lowStockThreshold ?? settings.lowStockDefault,
		images: imagePage,
		movements,
		can: { adjust: hasPermission(locals, 'stock.adjust') },
		adjustForm: await superValidate(zod4(stockAdjustSchema))
	};
};

/** Photo writes change what guests see and which files `/media` may serve. */
const refreshShop = () => {
	invalidate('catalog');
	invalidate('public-images');
};

export const actions = {
	addImage: async (event) => {
		const result = await images.actions.add(event, productId(event.params));
		refreshShop();
		return result;
	},
	editImage: async (event) => {
		const result = await images.actions.edit(event, productId(event.params));
		refreshShop();
		return result;
	},
	deleteImage: async (event) => {
		const result = await images.actions.delete(event, productId(event.params));
		refreshShop();
		return result;
	},

	/** A delivery, damage, a loss, or a stock count (`stock.adjustStock`). */
	adjust: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const form = await superValidate(event.request, zod4(stockAdjustSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the quantity.' }, { status: 400 });

		const { mode, reason, qty, counted, note } = form.data;
		try {
			await adjustStock(
				productId(event.params),
				mode === 'count'
					? { mode: 'count', counted, note: note || null }
					: { mode: 'move', reason: reason as StockReason, qty, note: note || null },
				{
					locals: { user: event.locals.user ? { id: event.locals.user.id } : null },
					getClientAddress: event.getClientAddress
				}
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
