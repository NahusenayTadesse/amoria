import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = { CHAPA_SECRET_KEY: 'CHASECK_TEST-spec' };
vi.mock('$env/dynamic/private', () => ({ env }));

const { initializeTransaction, verifyTransaction } = await import('./chapa');

const fetchMock = vi.fn();
beforeEach(() => {
	env.CHAPA_SECRET_KEY = 'CHASECK_TEST-spec';
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const params = {
	amount: 1300,
	name: 'Hana Tesfaye',
	phone: '+251911234567',
	email: null,
	txRef: 'am-o-1-abc',
	callbackUrl: 'https://amoria.test/cb',
	returnUrl: 'https://amoria.test/ret',
	description: 'Order AM-O-000001'
};

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('initializeTransaction', () => {
	it('sends the amount, names, local phone and our key, and returns the checkout URL', async () => {
		fetchMock.mockResolvedValue(
			Response.json({ status: 'success', data: { checkout_url: 'https://checkout.chapa.co/x' } })
		);
		expect(await initializeTransaction(params)).toBe('https://checkout.chapa.co/x');

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.chapa.co/v1/transaction/initialize');
		expect(init.headers.Authorization).toBe('Bearer CHASECK_TEST-spec');
		expect(sentBody()).toMatchObject({
			amount: '1300.00',
			currency: 'ETB',
			first_name: 'Hana',
			last_name: 'Tesfaye',
			phone_number: '0911234567',
			tx_ref: 'am-o-1-abc',
			customization: { title: 'Amoria', description: 'Order AM-O-000001' }
		});
	});

	it('leaves off a landline, and survives an Amharic-only name (Chapa wants Latin names)', async () => {
		fetchMock.mockResolvedValue(Response.json({ status: 'success', data: { checkout_url: 'u' } }));
		await initializeTransaction({ ...params, name: 'ሃና', phone: '0115512345' });
		expect(sentBody().phone_number).toBeUndefined();
		expect(sentBody().first_name).toBe('Customer');
	});

	it('strips characters Chapa rejects from the description', async () => {
		fetchMock.mockResolvedValue(Response.json({ status: 'success', data: { checkout_url: 'u' } }));
		await initializeTransaction({ ...params, description: 'Order #1 — "gifts" & more!' });
		expect(sentBody().customization.description).toMatch(/^[a-zA-Z0-9\s.\-_]+$/);
	});

	it('explains why Chapa refused, field by field', async () => {
		fetchMock.mockResolvedValue(
			Response.json(
				{ status: 'failed', message: { phone_number: ['The phone number is invalid'] } },
				{ status: 400 }
			)
		);
		await expect(initializeTransaction(params)).rejects.toThrow(
			'phone_number: The phone number is invalid'
		);
	});

	it('fails the payment, not the build, when the key is missing', async () => {
		env.CHAPA_SECRET_KEY = undefined;
		await expect(initializeTransaction(params)).rejects.toThrow(
			'CHAPA_SECRET_KEY is not configured'
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('verifyTransaction', () => {
	it('reads a successful payment', async () => {
		fetchMock.mockResolvedValue(
			Response.json({
				status: 'success',
				data: {
					status: 'success',
					amount: '1300.00',
					currency: 'ETB',
					tx_ref: 'am-o-1-abc',
					reference: 'R1'
				}
			})
		);
		expect(await verifyTransaction('am-o-1-abc')).toMatchObject({
			paid: true,
			failed: false,
			amount: 1300,
			currency: 'ETB',
			txRef: 'am-o-1-abc',
			reference: 'R1'
		});
	});

	it('reads an unknown reference (not paid yet) as not paid and not failed', async () => {
		fetchMock.mockResolvedValue(
			Response.json({ status: 'failed', message: 'Invalid transaction' }, { status: 400 })
		);
		expect(await verifyTransaction('x')).toMatchObject({ paid: false, failed: false });
	});

	it('reads a failed payment as failed', async () => {
		fetchMock.mockResolvedValue(Response.json({ status: 'success', data: { status: 'failed' } }));
		expect(await verifyTransaction('x')).toMatchObject({ paid: false, failed: true });
	});

	it('throws when Chapa itself is down, so the caller can try again later', async () => {
		fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));
		await expect(verifyTransaction('x')).rejects.toThrow('HTTP 502');
	});

	it('treats a non-JSON answer as not paid, keeping the text for the record', async () => {
		fetchMock.mockResolvedValue(new Response('<html>maintenance</html>', { status: 200 }));
		expect(await verifyTransaction('x')).toMatchObject({
			paid: false,
			raw: '<html>maintenance</html>'
		});
	});
});
