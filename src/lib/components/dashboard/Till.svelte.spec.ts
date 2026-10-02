import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Till from './Till.svelte';

type Found = {
	id: number;
	name: string;
	sku: string | null;
	barcode: string | null;
	price: number;
	unit: string;
	onFloor: number;
};

const scarf: Found = {
	id: 1,
	name: 'Silk scarf',
	sku: 'GFT-1',
	barcode: '2000000000015',
	price: 850,
	unit: 'pcs',
	onFloor: 5
};
const candle: Found = {
	...scarf,
	id: 2,
	name: 'Scented candle',
	sku: 'GFT-2',
	barcode: null,
	price: 250
};

const methods = [
	{ value: 'cash', name: 'Cash' },
	{ value: 'telebirr', name: 'Telebirr' }
];

function renderTill(props: { canDiscount?: boolean } = {}) {
	render(Till, {
		canDiscount: props.canDiscount ?? false,
		vat: { registered: false, rate: 15, included: true },
		methods
	});
}

/** The till searches through `fetch`; answer it with these products, whatever was typed. */
function stubSearch(results: Found[]) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ json: async () => ({ results }) }))
	);
}

beforeEach(() => stubSearch([scarf]));
afterEach(() => vi.unstubAllGlobals());

async function scan(text = '2000000000015') {
	const box = page.getByRole('searchbox', { name: 'Find a product' });
	await box.fill(text);
	await box.click();
	await page
		.getByRole('searchbox', { name: 'Find a product' })
		.element()
		.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

describe('Till', () => {
	it('adds a scanned product to the basket and shows the total', async () => {
		renderTill();
		await scan();
		await expect.element(page.getByText('Silk scarf')).toBeInTheDocument();
		await expect.element(page.getByText('ETB 850.00').first()).toBeInTheDocument();
	});

	it('cannot complete a sale until it is paid, and says how much is still to pay', async () => {
		renderTill();
		await scan();
		const complete = page.getByRole('button', { name: 'Complete sale' });
		await expect.element(complete).toBeDisabled();

		await page.getByLabelText('Amount paid by method 1').fill('500');
		await expect.element(page.getByText('Still to pay')).toBeInTheDocument();
		await expect.element(page.getByText('ETB 350.00').first()).toBeInTheDocument();
		await expect.element(complete).toBeDisabled();

		await page.getByLabelText('Amount paid by method 1').fill('850');
		await expect.element(complete).toBeEnabled();
	});

	it('gives change from cash', async () => {
		renderTill();
		await scan();
		await page.getByLabelText('Amount paid by method 1').fill('1000');
		await expect.element(page.getByText('Change')).toBeInTheDocument();
		await expect.element(page.getByText('ETB 150.00').first()).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Complete sale' })).toBeEnabled();
	});

	it('gives no change on a non-cash payment', async () => {
		renderTill();
		await scan();
		await page.getByLabelText('Payment method 1').selectOptions('telebirr');
		await page.getByLabelText('Amount paid by method 1').fill('1000');
		await expect
			.element(page.getByText('Only cash gives change', { exact: false }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Complete sale' })).toBeDisabled();
	});

	it('fills the exact cash amount in one tap', async () => {
		renderTill();
		await scan();
		await page.getByRole('button', { name: 'Exact cash' }).click();
		await expect.element(page.getByRole('button', { name: 'Complete sale' })).toBeEnabled();
	});

	it('lets only someone with permission change a price', async () => {
		renderTill({ canDiscount: false });
		await scan();
		expect(page.getByLabelText('Price of Silk scarf').elements()).toHaveLength(0);
	});

	it('shows a price box to someone who may discount', async () => {
		renderTill({ canDiscount: true });
		await scan();
		await expect.element(page.getByLabelText('Price of Silk scarf')).toBeInTheDocument();
	});

	it('warns when the basket asks for more than the shop floor holds', async () => {
		stubSearch([{ ...candle, onFloor: 1 }]);
		renderTill();
		await scan('candle');
		await page.getByRole('button', { name: 'One more Scented candle' }).click();
		await expect
			.element(page.getByText('Only 1 on the floor', { exact: false }))
			.toBeInTheDocument();
	});
});
