import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import {
	location,
	product,
	quote,
	requisition,
	requisitionLine,
	stockDocument,
	user
} from '$lib/server/db/schema';
import { REQUISITION_PURPOSE_LABELS, badge } from '$lib/stock';
import { reqLineAdd, reqLineEdit, requisitionHeader } from '$lib/schemas/inventory';
import { locationOptions, productOptions, quoteOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt } from '$lib/server/attempt';
import {
	cancelRequisition,
	decideRequisition,
	issueFromRequisition,
	saveRequisitionHeader,
	submitRequisition
} from '$lib/server/services/inventory/requisitions';

function requisitionId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Requisition not found');
	return id;
}

async function requireDraft(id: number) {
	const [req] = await db
		.select({ status: requisition.status })
		.from(requisition)
		.where(eq(requisition.id, id));
	if (!req) throw new WriteRefused(null, 'That requisition does not exist.');
	if (req.status !== 'draft') {
		throw new WriteRefused(null, 'That requisition has been sent; its lines are fixed.');
	}
}

const lines = childCrud({
	table: requisitionLine,
	ownerColumn: 'requisitionId',
	label: 'Line',
	addSchema: reqLineAdd,
	editSchema: reqLineEdit,
	permission: 'requisitions.request',
	transform: async (values, event) => {
		await requireDraft(requisitionId(event.params));
		return { ...values, note: values.note || null };
	}
});

export const load = async ({ params, locals }) => {
	const id = requisitionId(params);
	const [row] = await db
		.select({
			req: requisition,
			store: location.name,
			quoteRef: quote.ref,
			quoteName: quote.contactName,
			decidedBy: user.name
		})
		.from(requisition)
		.innerJoin(location, eq(location.id, requisition.locationId))
		.leftJoin(quote, eq(quote.id, requisition.quoteId))
		.leftJoin(user, eq(user.id, requisition.decidedBy))
		.where(eq(requisition.id, id));
	if (!row) error(404, 'Requisition not found');
	const req = row.req;
	const isDraft = req.status === 'draft';

	const named = await db
		.select({
			id: requisitionLine.id,
			productId: requisitionLine.productId,
			product: product.name,
			unit: product.unit,
			quantity: requisitionLine.quantity,
			approvedQuantity: requisitionLine.approvedQuantity,
			note: requisitionLine.note,
			inStore: sql<number>`COALESCE((SELECT SUM(b.quantity) FROM stock_balance b WHERE b.product_id = \`requisition_line\`.\`product_id\` AND b.location_id = ${req.locationId}), 0)`
		})
		.from(requisitionLine)
		.innerJoin(product, eq(product.id, requisitionLine.productId))
		.where(and(eq(requisitionLine.requisitionId, id), sql`${requisitionLine.deletedAt} IS NULL`))
		.orderBy(asc(requisitionLine.id));
	const table = named.map((l) => ({ ...l, inStore: Number(l.inStore) }));
	const byId = new Map(table.map((l) => [l.id, l]));

	const issues = await db
		.select({ id: stockDocument.id, number: stockDocument.number, status: stockDocument.status })
		.from(stockDocument)
		.where(and(eq(stockDocument.requisitionId, id), eq(stockDocument.type, 'issue')))
		.orderBy(asc(stockDocument.id));

	const linePage = isDraft ? await lines.load(id) : null;
	return {
		req,
		badge: badge(req.status),
		purposeLabel: REQUISITION_PURPOSE_LABELS[req.purpose],
		store: row.store,
		job: row.quoteRef ? `${row.quoteRef}: ${row.quoteName}` : null,
		decidedBy: row.decidedBy,
		isDraft,
		lines: table,
		issues: issues.map((i) => ({ ...i, badge: badge(i.status) })),
		can: {
			approve: hasPermission(locals, 'requisitions.approve'),
			issue: hasPermission(locals, 'stock.adjust'),
			own: req.submittedBy === locals.user?.id
		},
		lineSection: linePage
			? {
					addForm: linePage.addForm,
					editForm: linePage.editForm,
					rows: linePage.rows.map((r) => ({ ...byId.get(r.id), ...r }))
				}
			: null,
		products: isDraft ? await productOptions() : [],
		pickers: isDraft
			? { locations: await locationOptions(), quotes: await quoteOptions() }
			: { locations: [], quotes: [] },
		headerForm: isDraft
			? await superValidate(
					{
						purpose: req.purpose,
						requester: req.requester,
						quoteId: req.quoteId ?? undefined,
						requestDate: req.requestDate,
						neededBy: req.neededBy ?? '',
						locationId: req.locationId,
						note: req.note ?? ''
					},
					zod4(requisitionHeader)
				)
			: null
	};
};

/** Approved quantities from the decision form: `approve_<lineId>`; a blank box means all of it. */
async function quantitiesOf(request: Request) {
	const data = await request.formData();
	const quantities: Record<number, number> = {};
	for (const [key, value] of data.entries()) {
		const m = /^approve_(\d+)$/.exec(key);
		if (m && String(value).trim() !== '') quantities[Number(m[1])] = Number(value);
	}
	return { quantities, note: String(data.get('note') ?? '') };
}

export const actions = {
	header: async (event) => {
		const id = requisitionId(event.params);
		const form = await superValidate(event.request, zod4(requisitionHeader));
		if (!form.valid) return fail(400, { form });
		try {
			await saveRequisitionHeader(
				{
					id,
					header: {
						...form.data,
						quoteId: form.data.quoteId ?? null,
						neededBy: form.data.neededBy || null,
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

	addLine: async (event) => lines.actions.add(event, requisitionId(event.params)),
	editLine: async (event) => lines.actions.edit(event, requisitionId(event.params)),
	deleteLine: async (event) => lines.actions.delete(event, requisitionId(event.params)),

	submit: async (event) => {
		const id = requisitionId(event.params);
		return attempt(async () => {
			const number = await submitRequisition(id, actorOf(event));
			return { number };
		}, 'Sent for approval');
	},

	approve: async (event) => {
		requirePermission(event.locals, 'requisitions.approve');
		const id = requisitionId(event.params);
		const { quantities, note } = await quantitiesOf(event.request);
		return attempt(
			() =>
				decideRequisition(
					id,
					{ approve: true, note, quantities, allowOwn: event.locals.isSuperAdmin },
					actorOf(event)
				),
			'Approved'
		);
	},

	reject: async (event) => {
		requirePermission(event.locals, 'requisitions.approve');
		const id = requisitionId(event.params);
		const { note } = await quantitiesOf(event.request);
		return attempt(
			() =>
				decideRequisition(
					id,
					{ approve: false, note, allowOwn: event.locals.isSuperAdmin },
					actorOf(event)
				),
			'Rejected'
		);
	},

	/** Drafts the store issue with the approved quantities and opens it, ready to check and post. */
	issue: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const id = requisitionId(event.params);
		let issue: number | null = null;
		const result = await attempt(async () => {
			issue = await issueFromRequisition(id, actorOf(event));
		}, 'Issue drafted');
		if ('data' in result || issue === null) return result;
		redirect(303, `/dashboard/stock/documents/${issue}`);
	},

	cancel: async (event) =>
		attempt(
			() => cancelRequisition(requisitionId(event.params), actorOf(event)),
			'Requisition cancelled'
		)
};
