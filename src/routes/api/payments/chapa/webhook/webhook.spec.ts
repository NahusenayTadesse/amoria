import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = { CHAPA_WEBHOOK_SECRET: 'whsec-spec' };
vi.mock('$env/dynamic/private', () => ({ env }));
const verify = vi.fn();
vi.mock('$lib/server/services/payments', () => ({ verify: (ref: string) => verify(ref) }));

const { POST, GET } = await import('./+server');

let ip = 0;
function call(body: string, signature?: string | null) {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (signature) headers.set('chapa-signature', signature);
	const request = new Request('https://amoria.test/api/payments/chapa/webhook', {
		method: 'POST',
		body,
		headers
	});
	// A fresh address per call, so the rate limit does not interfere between tests.
	return POST({ request, getClientAddress: () => `10.0.0.${++ip}` } as never);
}
const sign = (body: string, secret = 'whsec-spec') =>
	createHmac('sha256', secret).update(body).digest('hex');

beforeEach(() => {
	env.CHAPA_WEBHOOK_SECRET = 'whsec-spec';
	verify.mockReset();
});

describe('Chapa webhook', () => {
	it('verifies the payment with Chapa when the signature is right', async () => {
		verify.mockResolvedValue({ status: 'paid', statusPath: '/o/x' });
		const body = JSON.stringify({ tx_ref: 'am-o-1-abc', status: 'success' });
		const res = await call(body, sign(body));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ received: true, settled: true });
		expect(verify).toHaveBeenCalledWith('am-o-1-abc');
	});

	it.each([
		['no signature', null],
		['a signature made with another secret', sign('{"tx_ref":"am-o-1-abc"}', 'guessed')],
		['a signature of different content', sign('{"tx_ref":"am-o-2-other"}')]
	])('rejects a call with %s, and never asks Chapa', async (_label, signature) => {
		const res = await call('{"tx_ref":"am-o-1-abc"}', signature);
		expect(res.status).toBe(401);
		expect(verify).not.toHaveBeenCalled();
	});

	it('refuses everything when the shop has no webhook secret configured', async () => {
		env.CHAPA_WEBHOOK_SECRET = '';
		const body = '{"tx_ref":"am-o-1-abc"}';
		expect((await call(body, sign(body))).status).toBe(500);
		expect(verify).not.toHaveBeenCalled();
	});

	it('asks Chapa to retry (503) while the payment is not confirmed yet', async () => {
		verify.mockResolvedValue({ status: 'pending', statusPath: '/o/x', retryable: true });
		const body = '{"tx_ref":"am-o-1-abc"}';
		const res = await call(body, sign(body));
		expect(res.status).toBe(503);
		expect(res.headers.get('retry-after')).toBe('60');
	});

	it('acknowledges what a retry cannot change (a mismatch), so Chapa stops', async () => {
		verify.mockResolvedValue({ status: 'pending', statusPath: '/o/x', retryable: false });
		const body = '{"tx_ref":"am-o-1-abc"}';
		expect((await call(body, sign(body))).status).toBe(200);
	});

	it('refuses a signed body without a reference, or that is not JSON', async () => {
		const noRef = '{"status":"success"}';
		expect((await call(noRef, sign(noRef))).status).toBe(400);
		const notJson = 'hello';
		expect((await call(notJson, sign(notJson))).status).toBe(400);
	});

	it('answers Chapa’s dashboard probe', async () => {
		const res = await GET({} as never);
		expect(await res.text()).toBe('ok');
	});
});
