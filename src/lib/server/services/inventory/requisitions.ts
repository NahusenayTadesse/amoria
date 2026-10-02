/**
 * Requisitions: a team (the décor crew, the school, the shop) asks the store for materials. It is
 * written and submitted by the team, approved (quantities may be cut) or rejected by someone else,
 * then filled by an ordinary issue from the store that points back at it — posting that issue marks
 * the requisition `issued` (`post.ts`). Never deleted (§5.0): a dropped one is `cancelled`.
 */
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import {
	location,
	product,
	requisition,
	requisitionLine,
	stockDocument
} from '$lib/server/db/schema';
import type { REQUISITION_PURPOSES } from '$lib/constants';
import type { Actor } from '../payments/payable';
import { saveDocument } from './documents';
import { nextNumber } from './numbering';

export type RequisitionHeader = {
	purpose: (typeof REQUISITION_PURPOSES)[number];
	requester: string;
	quoteId?: number | null;
	requestDate: string;
	neededBy?: string | null;
	locationId: number;
	note?: string | null;
};
export type RequisitionLineInput = { productId: number; quantity: number; note?: string | null };

/**
 * Creates a draft with a header and no lines yet, or changes a draft's header. The dashboard makes
 * the requisition first and adds its lines one at a time (`childCrud`); `saveRequisition` is for
 * callers that already have every line.
 */
export async function saveRequisitionHeader(
	input: { id?: number; header: RequisitionHeader },
	actor: Actor
): Promise<number> {
	const { header } = input;
	if (!header.requester.trim()) throw new WriteRefused('requester', 'Say who is asking.');
	return transaction(async (tx) => {
		const [store] = await tx
			.select({ kind: location.kind })
			.from(location)
			.where(and(eq(location.id, header.locationId), sql`${location.deletedAt} IS NULL`));
		if (!store) throw new WriteRefused('locationId', 'Choose the store it comes from.');
		if (store.kind === 'quarantine') {
			throw new WriteRefused('locationId', 'Stock in quarantine is not for use.');
		}
		const values = {
			...header,
			requester: header.requester.trim(),
			quoteId: header.quoteId ?? null,
			neededBy: header.neededBy || null,
			note: header.note?.trim() || null
		};
		if (!input.id) {
			return insertReturningId(tx, requisition, {
				...values,
				createdBy: actor.locals.user?.id ?? null
			});
		}
		const [existing] = await tx
			.select({ status: requisition.status })
			.from(requisition)
			.where(eq(requisition.id, input.id))
			.for('update');
		if (!existing) throw new WriteRefused(null, 'That requisition does not exist.');
		if (existing.status !== 'draft') {
			throw new WriteRefused(null, 'Only a draft requisition can be edited.');
		}
		await tx.update(requisition).set(values).where(eq(requisition.id, input.id));
		return input.id;
	});
}

/** Creates a draft, or replaces the header and lines of an existing draft. */
export async function saveRequisition(
	input: { id?: number; header: RequisitionHeader; lines: RequisitionLineInput[] },
	actor: Actor
): Promise<number> {
	const { header, lines } = input;
	if (!header.requester.trim()) throw new WriteRefused('requester', 'Say who is asking.');
	if (!lines.length) throw new WriteRefused('lines', 'Add at least one line.');
	if (lines.some((l) => !(l.quantity > 0) || !Number.isInteger(l.quantity))) {
		throw new WriteRefused('lines', 'Every line needs a whole quantity of at least 1.');
	}
	return transaction(async (tx) => {
		const [store] = await tx
			.select({ kind: location.kind })
			.from(location)
			.where(and(eq(location.id, header.locationId), sql`${location.deletedAt} IS NULL`));
		if (!store) throw new WriteRefused('locationId', 'Choose the store it comes from.');
		if (store.kind === 'quarantine') {
			throw new WriteRefused('locationId', 'Stock in quarantine is not for use.');
		}

		let id = input.id;
		const values = {
			...header,
			requester: header.requester.trim(),
			quoteId: header.quoteId ?? null,
			neededBy: header.neededBy || null,
			note: header.note?.trim() || null
		};
		if (id) {
			const [existing] = await tx
				.select({ status: requisition.status })
				.from(requisition)
				.where(eq(requisition.id, id))
				.for('update');
			if (!existing) throw new WriteRefused(null, 'That requisition does not exist.');
			if (existing.status !== 'draft') {
				throw new WriteRefused(null, 'Only a draft requisition can be edited.');
			}
			await tx.update(requisition).set(values).where(eq(requisition.id, id));
			await tx.delete(requisitionLine).where(eq(requisitionLine.requisitionId, id));
		} else {
			id = await insertReturningId(tx, requisition, {
				...values,
				createdBy: actor.locals.user?.id ?? null
			});
		}
		await tx.insert(requisitionLine).values(
			lines.map((l) => ({
				requisitionId: id!,
				productId: l.productId,
				quantity: l.quantity,
				note: l.note?.trim() || null
			}))
		);
		return id!;
	});
}

async function lockRequisition(tx: Parameters<Parameters<typeof transaction>[0]>[0], id: number) {
	const [req] = await tx.select().from(requisition).where(eq(requisition.id, id)).for('update');
	if (!req) throw new WriteRefused(null, 'That requisition does not exist.');
	return req;
}

/** Numbers a draft and sends it for approval. */
export async function submitRequisition(id: number, actor: Actor): Promise<string> {
	return transaction(async (tx) => {
		const req = await lockRequisition(tx, id);
		if (req.status !== 'draft')
			throw new WriteRefused(null, `That requisition is already ${req.status}.`);
		// Lines struck out while drafting are gone for good once it is submitted.
		await tx
			.delete(requisitionLine)
			.where(and(eq(requisitionLine.requisitionId, id), isNotNull(requisitionLine.deletedAt)));
		const [{ n }] = await tx
			.select({ n: sql<number>`COUNT(*)` })
			.from(requisitionLine)
			.where(eq(requisitionLine.requisitionId, id));
		if (!Number(n)) throw new WriteRefused(null, 'Add at least one line first.');

		const number = await nextNumber(tx, 'requisition', req.requestDate);
		await tx
			.update(requisition)
			.set({
				number,
				status: 'submitted',
				submittedAt: new Date(),
				submittedBy: actor.locals.user?.id ?? null
			})
			.where(eq(requisition.id, id));
		await recordAudit(tx, actor, {
			table: 'requisition',
			recordId: id,
			action: 'update',
			before: { status: 'draft' },
			after: { status: 'submitted', number }
		});
		return number;
	});
}

/**
 * Approves (at the quantities given per line; a line not mentioned is approved in full, 0 refuses
 * that line) or rejects with a reason. The person who submitted it cannot decide it, unless
 * `allowOwn` (an admin, in a small team where one person does both).
 */
export async function decideRequisition(
	id: number,
	input: {
		approve: boolean;
		note?: string | null;
		quantities?: Record<number, number>;
		allowOwn?: boolean;
	},
	actor: Actor
) {
	await transaction(async (tx) => {
		const req = await lockRequisition(tx, id);
		if (req.status !== 'submitted') {
			throw new WriteRefused(
				null,
				`That requisition is ${req.status}, not waiting for a decision.`
			);
		}
		const me = actor.locals.user?.id ?? null;
		if (!input.allowOwn && me && req.submittedBy === me) {
			throw new WriteRefused(null, 'Someone else has to decide your own requisition.');
		}
		if (!input.approve && !input.note?.trim()) {
			throw new WriteRefused('note', 'Say why it is rejected, so the team knows.');
		}

		if (input.approve) {
			const lines = await tx
				.select({
					id: requisitionLine.id,
					quantity: requisitionLine.quantity,
					name: product.name
				})
				.from(requisitionLine)
				.innerJoin(product, eq(product.id, requisitionLine.productId))
				.where(eq(requisitionLine.requisitionId, id));
			let any = false;
			for (const l of lines) {
				const given = input.quantities?.[l.id];
				const approved = given === undefined ? l.quantity : given;
				if (!Number.isInteger(approved) || approved < 0 || approved > l.quantity) {
					throw new WriteRefused(
						null,
						`${l.name}: approve between 0 and ${l.quantity}, as a whole number.`
					);
				}
				if (approved > 0) any = true;
				await tx
					.update(requisitionLine)
					.set({ approvedQuantity: approved })
					.where(eq(requisitionLine.id, l.id));
			}
			if (!any) throw new WriteRefused(null, 'Nothing is approved. Reject it instead.');
		}

		await tx
			.update(requisition)
			.set({
				status: input.approve ? 'approved' : 'rejected',
				decidedAt: new Date(),
				decidedBy: me,
				decisionNote: input.note?.trim() || null
			})
			.where(eq(requisition.id, id));
		await recordAudit(tx, actor, {
			table: 'requisition',
			recordId: id,
			action: 'update',
			before: { status: 'submitted' },
			after: { status: input.approve ? 'approved' : 'rejected' }
		});
	});
}

/**
 * The draft issue that fills an approved requisition: the approved quantities, from its store, to
 * the team. The storekeeper checks it and posts it, which marks the requisition issued. Returns
 * the draft's id.
 */
export async function issueFromRequisition(id: number, actor: Actor): Promise<number> {
	const [req] = await db.select().from(requisition).where(eq(requisition.id, id));
	if (!req) throw new WriteRefused(null, 'That requisition does not exist.');
	if (req.status !== 'approved') {
		throw new WriteRefused(
			null,
			req.status === 'issued'
				? 'That requisition has already been issued.'
				: 'Only an approved requisition can be issued.'
		);
	}
	const [open] = await db
		.select({ id: stockDocument.id })
		.from(stockDocument)
		.where(and(eq(stockDocument.requisitionId, id), eq(stockDocument.status, 'draft')));
	if (open) {
		throw new WriteRefused(
			null,
			'An issue for this requisition is already drafted. Post it or cancel it.'
		);
	}
	const lines = await db
		.select()
		.from(requisitionLine)
		.where(eq(requisitionLine.requisitionId, id))
		.orderBy(asc(requisitionLine.id));
	const due = lines.filter((l) => (l.approvedQuantity ?? l.quantity) > 0);
	return saveDocument(
		{
			header: {
				type: 'issue',
				docDate: localToday(),
				fromLocationId: req.locationId,
				party: req.requester,
				requisitionId: id,
				reference: req.number
			},
			lines: due.map((l) => ({
				productId: l.productId,
				quantity: l.approvedQuantity ?? l.quantity,
				note: l.note
			}))
		},
		actor
	);
}

/** Drops a requisition that has not been issued. */
export async function cancelRequisition(id: number, actor: Actor) {
	await transaction(async (tx) => {
		const req = await lockRequisition(tx, id);
		if (!['draft', 'submitted', 'approved'].includes(req.status)) {
			throw new WriteRefused(null, `That requisition is already ${req.status}.`);
		}
		await tx.update(requisition).set({ status: 'cancelled' }).where(eq(requisition.id, id));
		await recordAudit(tx, actor, {
			table: 'requisition',
			recordId: id,
			action: 'update',
			before: { status: req.status },
			after: { status: 'cancelled' }
		});
	});
}
