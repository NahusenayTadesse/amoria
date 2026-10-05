import { and, asc, eq } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { decorPackage, eventType, quoteRequest } from '$lib/server/db/schema';
import { publicToken } from '$lib/server/tokens';
import { cached } from '$lib/server/cache';
import type { QUOTE_REQUEST_STATUSES } from '$lib/constants';
import { upsertGuest, type GuestDetails } from './customers';
import type { Actor } from './payments/payable';
import type { QuoteRequestInput } from '$lib/schemas/quote';

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

/** What the "Plan your décor" form offers to choose from: event types and the packages on sale. */
export function quoteFormOptions() {
	return cached('quote:options', { ttlMs: 60_000, tags: ['catalog'] }, async () => {
		const [events, packages] = await Promise.all([
			db
				.select({ id: eventType.id, name: eventType.name, nameAm: eventType.nameAm })
				.from(eventType)
				.where(notDeleted(eventType))
				.orderBy(asc(eventType.sortOrder), asc(eventType.name)),
			db
				.select({
					id: decorPackage.id,
					slug: decorPackage.slug,
					name: decorPackage.name,
					nameAm: decorPackage.nameAm,
					eventTypeId: decorPackage.eventTypeId
				})
				.from(decorPackage)
				.where(and(eq(decorPackage.isActive, true), notDeleted(decorPackage)))
				.orderBy(asc(decorPackage.sortOrder), asc(decorPackage.name))
		]);
		return { events, packages };
	});
}

/**
 * Saves a customer's request for a quote. A request with a `clientRef` already saved is returned
 * as it is rather than saved again, so a request queued offline and sent twice is one request.
 * `contact.phone` is already normalised.
 */
export async function createQuoteRequest(
	input: QuoteRequestInput,
	contact: GuestDetails
): Promise<{ id: number; token: string; duplicate: boolean }> {
	if (input.eventDate && input.eventDate < localToday()) {
		throw new WriteRefused('eventDate', 'That date has already passed.');
	}
	const clientRef = input.clientRef || null;

	return transaction(async (tx) => {
		if (clientRef) {
			const [existing] = await tx
				.select({ id: quoteRequest.id, token: quoteRequest.publicToken })
				.from(quoteRequest)
				.where(eq(quoteRequest.clientRef, clientRef));
			if (existing) return { ...existing, duplicate: true };
		}

		const customerId = await upsertGuest(tx, contact);
		const token = publicToken();
		const id = await insertReturningId(tx, quoteRequest, {
			publicToken: token,
			customerId,
			contactName: contact.name,
			contactPhone: contact.phone,
			contactEmail: contact.email,
			eventTypeId: input.eventTypeId ?? null,
			eventDate: input.eventDate || null,
			venue: input.venue || null,
			guestCount: input.guestCount ?? null,
			theme: input.theme || null,
			budget: input.budget ?? null,
			packageId: input.packageId ?? null,
			message: input.message || null,
			preferredChannel: input.preferredChannel,
			clientRef
		});
		return { id, token, duplicate: false };
	});
}

/** Staff move a request along (new, contacted, quoted, won, lost). Any move is allowed. */
export async function setQuoteRequestStatus(
	id: number,
	to: QuoteRequestStatus,
	actor: Actor,
	assignTo?: string | null
) {
	await transaction(async (tx) => {
		const [row] = await tx
			.select({ status: quoteRequest.status, assignedTo: quoteRequest.assignedTo })
			.from(quoteRequest)
			.where(eq(quoteRequest.id, id))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That request does not exist.');

		await tx
			.update(quoteRequest)
			.set({ status: to, assignedTo: assignTo === undefined ? row.assignedTo : assignTo })
			.where(eq(quoteRequest.id, id));
		await recordAudit(tx, actor, {
			table: 'quote_request',
			recordId: id,
			action: 'update',
			before: { status: row.status, assignedTo: row.assignedTo },
			after: { status: to, assignedTo: assignTo === undefined ? row.assignedTo : assignTo }
		});
	});
}
