/**
 * Chapa's hosted checkout, ported from fixtec (§7). Two calls: start a checkout, and ask whether a
 * payment went through. Nothing here decides that a record is paid — `payments.verify` does, and
 * only on the answer from `verifyTransaction`, never on a redirect or a webhook body alone.
 */
import { env } from '$env/dynamic/private';
import { localPhone } from '@nahu/admin-kit/phone';

const CHAPA_BASE = 'https://api.chapa.co/v1';

/** Read per call (dynamic env), so a missing key fails the payment, not the build. */
function secretKey() {
	const key = env.CHAPA_SECRET_KEY?.trim();
	if (!key) throw new Error('CHAPA_SECRET_KEY is not configured');
	return key;
}

/** Chapa only accepts letters, digits, spaces, dots, hyphens and underscores in these. */
function sanitizeText(text: string, fallback: string) {
	return (
		text
			.replace(/[^a-zA-Z0-9\s.\-_]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim() || fallback
	);
}

export type InitializeParams = {
	amount: number;
	name: string;
	/** Optional: Chapa accepts a checkout without one (checked against the test API). */
	email?: string | null;
	phone?: string | null;
	txRef: string;
	callbackUrl: string;
	returnUrl: string;
	description: string;
};

/** Starts a hosted checkout and returns the URL to send the customer to. */
export async function initializeTransaction(params: InitializeParams): Promise<string> {
	// Chapa wants Latin first and last names; an Amharic-only name falls back to "Customer".
	const [firstName, ...rest] = sanitizeText(params.name, 'Customer').split(' ');

	const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			amount: params.amount.toFixed(2),
			currency: 'ETB',
			email: params.email || undefined,
			first_name: firstName,
			last_name: rest.join(' ') || firstName,
			// Ten-digit local mobile, or left off: a landline would fail the whole payment.
			phone_number: localPhone(params.phone) ?? undefined,
			tx_ref: params.txRef,
			callback_url: params.callbackUrl,
			return_url: params.returnUrl,
			customization: {
				// Chapa caps the title at 16 characters.
				title: 'Amoria',
				description: sanitizeText(params.description, 'Payment to Amoria')
			}
		}),
		signal: AbortSignal.timeout(15_000)
	});

	const data = await res.json().catch(() => null);

	if (!res.ok || data?.status !== 'success' || !data?.data?.checkout_url) {
		const detail =
			typeof data?.message === 'string'
				? data.message
				: data?.message
					? Object.entries(data.message)
							.map(
								([field, messages]) =>
									`${field}: ${([] as string[]).concat(messages as string[]).join(', ')}`
							)
							.join('; ')
					: `HTTP ${res.status}`;
		throw new Error(`Chapa could not start the payment: ${detail}`);
	}

	return data.data.checkout_url as string;
}

export type Verification = {
	/** Chapa says the payment went through. */
	paid: boolean;
	/** Chapa says it definitively failed, as opposed to "not finished yet". */
	failed: boolean;
	amount: number;
	currency?: string;
	txRef?: string;
	reference?: string;
	/** The response, for `payment.verifyPayload`. */
	raw: string;
};

/** Asks Chapa, server to server, what happened to a payment. */
export async function verifyTransaction(txRef: string): Promise<Verification> {
	const res = await fetch(`${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
		headers: { Authorization: `Bearer ${secretKey()}` },
		signal: AbortSignal.timeout(15_000)
	});
	const text = await res.text();

	// An unknown reference is a 400 with `status: "failed"` — "nothing paid yet", which is also
	// what an abandoned checkout looks like. Only a 5xx means Chapa could not answer.
	if (res.status >= 500) throw new Error(`Chapa verify failed: HTTP ${res.status}`);

	let data: { status?: string; data?: Record<string, unknown> } | null = null;
	try {
		data = JSON.parse(text);
	} catch {
		// Not JSON: treated as "not paid", and the raw text is kept for the record.
	}

	const status = data?.data?.status;
	return {
		paid: data?.status === 'success' && status === 'success',
		failed: status === 'failed',
		amount: Number(data?.data?.amount),
		currency: data?.data?.currency as string | undefined,
		txRef: data?.data?.tx_ref as string | undefined,
		reference: data?.data?.reference as string | undefined,
		raw: text.slice(0, 2000)
	};
}
