import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Component } from 'svelte';
import { Bag } from './bag.svelte';
import ProductCard from './ProductCard.svelte';
import WithBag from './testing/WithBag.svelte';

const gift = (overrides: Record<string, unknown> = {}) => ({
	id: 1,
	name: 'Red rose bouquet',
	nameAm: 'የቀይ ጽጌረዳ እቅፍ',
	price: 1450,
	stockQty: 8,
	isFeatured: false,
	image: null,
	imageAlt: null,
	...overrides
});

function renderCard(product = gift(), onopen = vi.fn()) {
	const bag = new Bag(() => [product]);
	render(WithBag, {
		bag,
		component: ProductCard as unknown as Component<Record<string, unknown>>,
		innerProps: { product, onopen }
	});
	return { bag, onopen };
}

beforeEach(() => localStorage.clear());

describe('ProductCard', () => {
	it('shows the name and price in birr', async () => {
		renderCard();
		await expect
			.element(page.getByRole('heading', { name: 'Red rose bouquet' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('ETB 1,450.00')).toBeInTheDocument();
	});

	it('tapping the photo opens the product sheet', async () => {
		const { onopen } = renderCard();
		await page.getByRole('button', { name: 'Red rose bouquet: see details' }).click();
		expect(onopen).toHaveBeenCalledOnce();
	});

	it('the + button turns into a stepper that stops at the stock', async () => {
		const { bag } = renderCard(gift({ stockQty: 2 }));
		await page.getByRole('button', { name: 'Add Red rose bouquet to bag' }).click();
		const more = page.getByRole('button', { name: 'One more Red rose bouquet' });
		await more.click();
		expect(bag.qtyOf(1)).toBe(2);
		await expect.element(more).toBeDisabled();

		await page.getByRole('button', { name: 'One fewer Red rose bouquet' }).click();
		await page.getByRole('button', { name: 'One fewer Red rose bouquet' }).click();
		expect(bag.qtyOf(1)).toBe(0);
		await expect
			.element(page.getByRole('button', { name: 'Add Red rose bouquet to bag' }))
			.toBeInTheDocument();
	});

	it('says sold out and offers no way to add when there is no stock', async () => {
		renderCard(gift({ stockQty: 0 }));
		await expect.element(page.getByText('Sold out')).toBeInTheDocument();
		expect(page.getByRole('button', { name: /Add .* to bag/ }).elements()).toHaveLength(0);
	});

	it('warns when only a few are left', async () => {
		renderCard(gift({ stockQty: 2 }));
		await expect.element(page.getByText('Only 2 left')).toBeInTheDocument();
	});

	it('shows the photo from the public media route, with its description', async () => {
		renderCard(gift({ image: 'rose.webp', imageAlt: 'Twelve red roses' }));
		const img = page.getByRole('img', { name: 'Twelve red roses' });
		await expect.element(img).toHaveAttribute('src', '/media/rose.webp');
	});
});
