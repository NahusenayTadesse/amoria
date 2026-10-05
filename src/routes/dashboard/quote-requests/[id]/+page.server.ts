import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { decorPackage, eventType, quoteRequest, user } from '$lib/server/db/schema';
import { setQuoteRequestStatus } from '$lib/server/services/quotes';
import { actorOf } from '$lib/server/paymentAdmin';
import { QUOTE_REQUEST_STATUSES } from '$lib/constants';

function requestId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Request not found');
	return id;
}

export const load = async ({ params }) => {
	const id = requestId(params);
	const [row] = await db
		.select({
			request: quoteRequest,
			eventName: eventType.name,
			packageName: decorPackage.name,
			assigneeName: user.name
		})
		.from(quoteRequest)
		.leftJoin(eventType, eq(eventType.id, quoteRequest.eventTypeId))
		.leftJoin(decorPackage, eq(decorPackage.id, quoteRequest.packageId))
		.leftJoin(user, eq(user.id, quoteRequest.assignedTo))
		.where(eq(quoteRequest.id, id));
	if (!row) error(404, 'Request not found');
	return row;
};

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'quotes.manage');
		const data = await event.request.formData();
		const to = String(data.get('to'));
		if (!(QUOTE_REQUEST_STATUSES as readonly string[]).includes(to)) {
			return fail(400, { error: 'Choose a status.' });
		}
		// "Assign to me" rides along: the person who works a request owns it.
		const mine = data.get('assign') === 'me' ? (event.locals.user?.id ?? null) : undefined;
		try {
			await setQuoteRequestStatus(
				requestId(event.params),
				to as (typeof QUOTE_REQUEST_STATUSES)[number],
				actorOf(event),
				mine
			);
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
		return { done: 'Request updated' };
	}
};
