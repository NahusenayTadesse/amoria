import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { product } from '$lib/server/db/schema';
import { inStoreBarcode, isValidEan13 } from '$lib/barcode';
import { makeProduct, resetDb } from '$lib/server/testing/db';
import { assignBarcodes, barcodeSvg, labelsFor } from './barcodes';

beforeEach(resetDb);

describe('assignBarcodes', () => {
	it('gives in-store EAN-13 codes to products without one, and leaves the rest alone', async () => {
		const bare = await makeProduct({ stockQty: 0 });
		const own = await makeProduct({ stockQty: 0, barcode: '6001234567892' });
		expect(await assignBarcodes()).toBe(1);
		const [a] = await db.select().from(product).where(eq(product.id, bare));
		const [b] = await db.select().from(product).where(eq(product.id, own));
		expect(a.barcode).toBe(inStoreBarcode(bare));
		expect(isValidEan13(a.barcode!)).toBe(true);
		expect(b.barcode).toBe('6001234567892');
		expect(await assignBarcodes()).toBe(0);
	});

	it('skips a product whose in-store code a manufacturer code already occupies', async () => {
		const bare = await makeProduct({ stockQty: 0 });
		await makeProduct({ stockQty: 0, barcode: inStoreBarcode(bare) });
		expect(await assignBarcodes()).toBe(0);
	});
});

describe('labels', () => {
	it('renders EAN-13 for a valid code and Code 128 for a SKU', () => {
		const ean = barcodeSvg(inStoreBarcode(7));
		const sku = barcodeSvg('GFT-001');
		expect(ean).toContain('<svg');
		expect(sku).toContain('<svg');
		expect(ean).not.toBe(sku);
		expect(barcodeSvg('')).toBe('');
	});

	it('prints the barcode, else the SKU, for chosen products', async () => {
		const withCode = await makeProduct({
			stockQty: 0,
			name: 'A',
			barcode: inStoreBarcode(5),
			price: 90
		});
		const withSku = await makeProduct({ stockQty: 0, name: 'B', sku: 'B-1' });
		const labels = await labelsFor({ productIds: [withCode, withSku] });
		expect(labels.map((l) => [l.name, l.barcode, l.price])).toEqual([
			['A', inStoreBarcode(5), 90],
			['B', 'B-1', 100]
		]);
		expect(labels.every((l) => l.svg.includes('<svg'))).toBe(true);
	});
});
