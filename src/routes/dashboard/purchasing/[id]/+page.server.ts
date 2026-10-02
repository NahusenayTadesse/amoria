import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import {
	location,
	product,
	purchaseOrder,
	purchaseOrderLine,
	stockDocument,
	supplier
} from '$lib/server/db/schema';
import { badge } from '$lib/stock';
import { orderHeader, orderLineAdd, orderLineEdit } from '$lib/schemas/inventory';
import { locationOptions, productOptions, supplierOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt } from '$lib/server/attempt';
import {
	cancelOrder,
	closeOrder,
	draftReceiptFromOrder,
	markOrdered,
	receivedByLine,
	saveOrderHeader
} from '$lib/server/services/inventory/purchasing';

function orderId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Order not found');
	return id;
}

/** Lines can change only while the order is a draft: an ordered one is what the supplier was sent. */
async function requireDraft(id: number) {
	const [order] = await db
		.select({ status: purchaseOrder.status })
		.from(purchaseOrder)
		.where(eq(purchaseOrder.id, id));
	if (!order) throw new WriteRefused(null, 'That order does not exist.');
	if (order.status !== 'draft') {
		throw new WriteRefused(null, 'That order is placed; its lines are fixed.');
	}
}

const lines = childCrud({
	table: purchaseOrderLine,
	ownerColumn: 'purchaseOrderId',
	label: 'Line',
	addSchema: orderLineAdd,
	editSchema: orderLineEdit,
	permission: 'purchasing.manage',
	transform: async (values, event) => {
		await requireDraft(orderId(event.params));
		return { ...values, unitCost: values.unitCost ?? null, note: values.note || null };
	}
});

export const load = async ({ params }) => {
	const id = orderId(params);
	const [row] = await db
		.select({ order: purchaseOrder, supplier: supplier.name, location: location.name })
		.from(purchaseOrder)
		.innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
		.innerJoin(location, eq(location.id, purchaseOrder.locationId))
		.where(eq(purchaseOrder.id, id));
	if (!row) error(404, 'Order not found');
	const order = row.order;
	const isDraft = order.status === 'draft';

	const received = await receivedByLine(db, id);
	const named = await db
		.select({
			id: purchaseOrderLine.id,
			productId: purchaseOrderLine.productId,
			product: product.name,
			unit: product.unit,
			quantity: purchaseOrderLine.quantity,
			unitCost: purchaseOrderLine.unitCost,
			note: purchaseOrderLine.note
		})
		.from(purchaseOrderLine)
		.innerJoin(product, eq(product.id, purchaseOrderLine.productId))
		.where(
			and(eq(purchaseOrderLine.purchaseOrderId, id), sql`${purchaseOrderLine.deletedAt} IS NULL`)
		)
		.orderBy(asc(purchaseOrderLine.id));
	const table = named.map((l) => {
		const got = received.get(l.id) ?? 0;
		return {
			...l,
			received: got,
			due: Math.max(0, l.quantity - got),
			lineTotal: Math.round((l.unitCost ?? 0) * l.quantity * 100) / 100
		};
	});

	const receipts = await db
		.select({ id: stockDocument.id, number: stockDocument.number, status: stockDocument.status })
		.from(stockDocument)
		.where(and(eq(stockDocument.purchaseOrderId, id), eq(stockDocument.type, 'receipt')))
		.orderBy(asc(stockDocument.id));

	const linePage = isDraft ? await lines.load(id) : null;
	const byId = new Map(table.map((l) => [l.id, l]));
	const total = table.reduce((sum, l) => sum + l.lineTotal, 0);

	return {
		order,
		badge: badge(order.status),
		supplier: row.supplier,
		location: row.location,
		isDraft,
		lines: table,
		total: Math.round(total * 100) / 100,
		receipts: receipts.map((r) => ({ ...r, badge: badge(r.status) })),
		lineSection: linePage
			? {
					addForm: linePage.addForm,
					editForm: linePage.editForm,
					rows: linePage.rows.map((r) => ({ ...byId.get(r.id), ...r }))
				}
			: null,
		products: isDraft ? await productOptions() : [],
		pickers: isDraft
			? { suppliers: await supplierOptions(), locations: await locationOptions() }
			: { suppliers: [], locations: [] },
		headerForm: isDraft
			? await superValidate(
					{
						supplierId: order.supplierId,
						orderDate: order.orderDate,
						expectedDate: order.expectedDate ?? '',
						locationId: order.locationId,
						reference: order.reference ?? '',
						note: order.note ?? ''
					},
					zod4(orderHeader)
				)
			: null
	};
};

export const actions = {
	header: async (event) => {
		const id = orderId(event.params);
		const form = await superValidate(event.request, zod4(orderHeader));
		if (!form.valid) return fail(400, { form });
		try {
			await saveOrderHeader(
				{
					id,
					header: {
						...form.data,
						expectedDate: form.data.expectedDate || null,
						reference: form.data.reference || null,
						note: form.data.note || null
					}
				},
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Details saved' });
	},

	addLine: async (event) => lines.actions.add(event, orderId(event.params)),
	editLine: async (event) => lines.actions.edit(event, orderId(event.params)),
	deleteLine: async (event) => lines.actions.delete(event, orderId(event.params)),

	order: async (event) => {
		const id = orderId(event.params);
		return attempt(async () => {
			const number = await markOrdered(id, actorOf(event));
			return { number };
		}, 'Order placed. Send it to the supplier.');
	},

	cancel: async (event) =>
		attempt(() => cancelOrder(orderId(event.params), actorOf(event)), 'Order cancelled'),
	close: async (event) =>
		attempt(() => closeOrder(orderId(event.params), actorOf(event)), 'Order closed'),

	/** Drafts the goods receipt for what is still due and opens it, ready to correct and post. */
	receive: async (event) => {
		const id = orderId(event.params);
		let receipt: number | null = null;
		const result = await attempt(async () => {
			receipt = await draftReceiptFromOrder(id, actorOf(event));
		}, 'Receipt drafted');
		if ('data' in result || receipt === null) return result;
		redirect(303, `/dashboard/stock/documents/${receipt}`);
	}
};
