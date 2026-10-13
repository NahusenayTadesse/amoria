import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { quoteRequest, user } from '$lib/server/db/schema';
import { setQuoteRequestStatus } from '$lib/server/services/quotes';
import { actorOf } from '$lib/server/paymentAdmin';
import { MESSAGE_STATUSES } from '$lib/quoteRequestStatus';

function messageId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Message not found');
	return id;
}

/** One note from the contact page. Only `contact` rows: a quote request is not a message. */
export const load = async ({ params }) => {
	const [row] = await db
		.select({ message: quoteRequest, assigneeName: user.name })
		.from(quoteRequest)
		.leftJoin(user, eq(user.id, quoteRequest.assignedTo))
		.where(and(eq(quoteRequest.id, messageId(params)), eq(quoteRequest.kind, 'contact')));
	if (!row) error(404, 'Message not found');
	return row;
};

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'quotes.manage');
		const data = await event.request.formData();
		const to = String(data.get('to'));
		if (!(MESSAGE_STATUSES as readonly string[]).includes(to)) {
			return fail(400, { error: 'Choose a status.' });
		}
		// The person who replies owns the message.
		const mine = to === 'contacted' ? (event.locals.user?.id ?? null) : undefined;
		try {
			await setQuoteRequestStatus(
				messageId(event.params),
				to as (typeof MESSAGE_STATUSES)[number],
				actorOf(event),
				mine
			);
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
		return { done: to === 'contacted' ? 'Marked replied' : 'Marked new' };
	}
};
