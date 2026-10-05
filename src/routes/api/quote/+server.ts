import { json } from '@sveltejs/kit';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { quoteRequestSchema } from '$lib/schemas/quote';
import { createQuoteRequest } from '$lib/server/services/quotes';
import { takeToken } from '$lib/server/rateLimit';

/**
 * The "Plan your décor" request as JSON, for the browser's offline queue and its service worker
 * (the page's own form posts to the page's action). Validated by the same schema; a request sent
 * twice is saved once (its `clientRef`). Answers 400 with the first problem, which the queue
 * treats as final, so a malformed entry does not sit in the browser forever; 429 and 5xx it keeps.
 */
export const POST = async ({ request, getClientAddress }) => {
	if (!takeToken(`quote:${getClientAddress()}`, { capacity: 6, perMinute: 6 })) {
		return json({ error: 'Too many requests' }, { status: 429 });
	}
	const body = await request.json().catch(() => null);
	const parsed = quoteRequestSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const { name, email } = parsed.data;
	try {
		const created = await createQuoteRequest(parsed.data, {
			name,
			phone: normalizePhone(parsed.data.phone)!,
			email: email || null,
			locale: body?.locale === 'am' ? 'am' : 'en'
		});
		return json({ ok: true, duplicate: created.duplicate });
	} catch (err) {
		if (err instanceof WriteRefused) return json({ error: err.message }, { status: 400 });
		console.error('Quote request failed:', err);
		return json({ error: 'Failed' }, { status: 500 });
	}
};
