import { json, type RequestHandler } from '@sveltejs/kit';
import { verify } from '$lib/server/services/payments';
import { takeToken } from '$lib/server/rateLimit';

/**
 * Chapa's `callback_url`, called server to server when a checkout finishes. Like the webhook it
 * only *triggers* a check — `verify()` asks Chapa before anything is paid — so it needs no
 * signature.
 */
export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	if (!takeToken(`webhook:${getClientAddress()}`, { capacity: 60, perMinute: 60 })) {
		return json({ error: 'Too many requests.' }, { status: 429 });
	}
	const txRef = url.searchParams.get('trx_ref') ?? url.searchParams.get('tx_ref');
	if (!txRef) return json({ error: 'No transaction reference.' }, { status: 400 });

	const outcome = await verify(txRef);
	return json({ settled: outcome.status === 'paid' });
};
