import { describe, expect, it } from 'vitest';
import { cartLines, checkoutSchema, transferSchema } from './checkout';

const valid = { name: 'Hana Tesfaye', phone: '0911 23 45 67' };
const receipt = (type = 'image/png', size = 1000) =>
	new File([new Uint8Array(size)], 'r.png', { type });

/** The field paths a parse complains about. */
function problems(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
	return result.success ? [] : result.error!.issues.map((i) => i.path.join('.'));
}

describe('checkout form', () => {
	it('accepts a pickup order paid with Chapa with just a name and a phone', () => {
		const result = checkoutSchema.safeParse(valid);
		expect(result.success).toBe(true);
		expect(result.data).toMatchObject({ fulfilment: 'pickup', method: 'chapa', email: '' });
	});

	it.each(['0911234567', '911234567', '+251911234567', '0711 234 567', '+251-71-123-4567'])(
		'accepts the phone %s',
		(phone) => expect(checkoutSchema.safeParse({ ...valid, phone }).success).toBe(true)
	);

	it.each(['0115512345', '12345', '', '+14155551234'])('refuses the phone %s', (phone) => {
		expect(problems(checkoutSchema.safeParse({ ...valid, phone }))).toContain('phone');
	});

	it('refuses a one-letter name and a malformed email, but allows no email', () => {
		expect(problems(checkoutSchema.safeParse({ ...valid, name: 'H' }))).toContain('name');
		expect(problems(checkoutSchema.safeParse({ ...valid, email: 'not-an-email' }))).toContain(
			'email'
		);
		expect(checkoutSchema.safeParse({ ...valid, email: '' }).success).toBe(true);
	});

	it('asks for an area and an address when delivering', () => {
		const result = checkoutSchema.safeParse({ ...valid, fulfilment: 'delivery' });
		expect(problems(result)).toEqual(expect.arrayContaining(['deliveryAreaId', 'deliveryAddress']));

		const ok = checkoutSchema.safeParse({
			...valid,
			fulfilment: 'delivery',
			deliveryAreaId: '4',
			deliveryAddress: 'Near Edna Mall'
		});
		expect(ok.success).toBe(true);
		expect(ok.data?.deliveryAreaId).toBe(4);
	});

	it('asks for the account and the receipt when paying by transfer', () => {
		expect(problems(checkoutSchema.safeParse({ ...valid, method: 'transfer' }))).toEqual(
			expect.arrayContaining(['bankAccountId', 'receipt'])
		);
		expect(
			checkoutSchema.safeParse({
				...valid,
				method: 'transfer',
				bankAccountId: '1',
				receipt: receipt()
			}).success
		).toBe(true);
	});

	it('does not ask for a receipt when paying with Chapa', () => {
		expect(checkoutSchema.safeParse({ ...valid, method: 'chapa' }).success).toBe(true);
	});
});

describe('the posted bag', () => {
	it('accepts sensible lines', () => {
		expect(cartLines.safeParse([{ productId: 1, qty: 2 }]).success).toBe(true);
	});

	it.each([
		['an empty bag', []],
		['a zero quantity', [{ productId: 1, qty: 0 }]],
		['a negative quantity', [{ productId: 1, qty: -3 }]],
		['more than 20 of one item', [{ productId: 1, qty: 21 }]],
		['a fractional quantity', [{ productId: 1, qty: 1.5 }]],
		['a made-up product id', [{ productId: 'drop table', qty: 1 }]],
		['21 lines', Array.from({ length: 21 }, (_, i) => ({ productId: i + 1, qty: 1 }))]
	])('refuses %s', (_label, lines) => {
		expect(cartLines.safeParse(lines).success).toBe(false);
	});

	it('ignores a price smuggled into a line', () => {
		const parsed = cartLines.parse([{ productId: 1, qty: 1, price: 1 }]);
		expect(parsed[0]).toEqual({ productId: 1, qty: 1 });
	});
});

describe('transfer receipt', () => {
	it('accepts a photo or a PDF', () => {
		for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']) {
			expect(transferSchema.safeParse({ bankAccountId: '1', receipt: receipt(type) }).success).toBe(
				true
			);
		}
	});

	it('refuses other files, empty files and files over 10 MB', () => {
		expect(
			transferSchema.safeParse({ bankAccountId: '1', receipt: receipt('text/html') }).success
		).toBe(false);
		expect(
			transferSchema.safeParse({ bankAccountId: '1', receipt: receipt('image/png', 0) }).success
		).toBe(false);
		expect(
			transferSchema.safeParse({
				bankAccountId: '1',
				receipt: receipt('image/png', 10 * 1024 * 1024 + 1)
			}).success
		).toBe(false);
	});

	it('needs an account', () => {
		expect(problems(transferSchema.safeParse({ receipt: receipt() }))).toContain('bankAccountId');
	});
});
