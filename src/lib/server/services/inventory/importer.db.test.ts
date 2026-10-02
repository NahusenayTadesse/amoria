import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { category, product, stockDocument, supplier } from '$lib/server/db/schema';
import { actorFor, makeProduct, makeSupplier, resetDb, stockOf } from '$lib/server/testing/db';
import {
	ImportError,
	planImport,
	readTable,
	runImport,
	templateCsv,
	type SheetRow
} from './importer';

beforeEach(resetDb);

const actor = actorFor(null);
const bytes = (text: string) => new TextEncoder().encode(text);
const sheet = (rows: Record<string, string>[]): SheetRow[] =>
	rows.map((values, i) => ({ row: i + 2, values }));

describe('readTable', () => {
	it('reads a CSV whatever the header spelling, and reports columns it ignored', async () => {
		const { rows, ignored } = await readTable('products', {
			name: 'stock.csv',
			bytes: bytes(
				'Product Code,PRODUCT NAME,selling price,Colour\nGFT-1,Silk scarf,850,red\n,,,\nGFT-2,Candle,120,blue\n'
			)
		});
		expect(ignored).toEqual(['Colour']);
		expect(rows).toEqual([
			{ row: 2, values: { sku: 'GFT-1', name: 'Silk scarf', price: '850' } },
			{ row: 4, values: { sku: 'GFT-2', name: 'Candle', price: '120' } }
		]);
	});

	it('reads a semicolon file with a byte-order mark and quoted commas', async () => {
		const { rows } = await readTable('suppliers', {
			name: 's.csv',
			bytes: bytes('﻿Name;Phone\n"Habesha, Wholesale";0911234567\n')
		});
		expect(rows[0].values).toEqual({ name: 'Habesha, Wholesale', phone: '0911234567' });
	});

	it('refuses the wrong file type, empty files and files with no known headings', async () => {
		await expect(readTable('products', { name: 'a.pdf', bytes: bytes('x') })).rejects.toThrow(
			ImportError
		);
		await expect(readTable('products', { name: 'a.csv', bytes: bytes('  \n') })).rejects.toThrow(
			/empty/
		);
		await expect(
			readTable('products', { name: 'a.csv', bytes: bytes('foo,bar\n1,2\n') })
		).rejects.toThrow(/No column heading/);
		await expect(readTable('products', { name: 'a.csv', bytes: bytes('Name\n') })).rejects.toThrow(
			/no rows/
		);
	});

	it('makes a template that reads back', async () => {
		for (const kind of ['products', 'suppliers', 'opening'] as const) {
			const { rows } = await readTable(kind, { name: 't.csv', bytes: bytes(templateCsv(kind)) });
			expect(rows).toHaveLength(1);
		}
	});
});

describe('products', () => {
	it('creates unpublished products, makes categories, and updates by SKU without touching stock', async () => {
		const s = await makeSupplier({ name: 'Habesha Wholesale' });
		const old = await makeProduct({ sku: 'GFT-1', name: 'Old name', stockQty: 7, price: 100 });

		const rows = sheet([
			{ sku: 'GFT-1', name: 'Old name', price: '150', cost: '90' },
			{
				sku: 'GFT-2',
				name: 'Silk scarf',
				category: 'Scarves',
				price: '850',
				supplier: 'habesha wholesale',
				reorderLevel: '4',
				trackLots: 'no'
			},
			{ name: 'Ribbon', kind: 'material', unit: 'm', cost: '12' }
		]);
		const plan = await planImport('products', rows);
		expect(plan).toMatchObject({ problems: 0, creates: 2, updates: 1 });
		expect(plan.rows[0].warnings[0]).toMatch(/Cost is only used for new products/);

		expect(await runImport('products', rows, actor)).toEqual({
			created: 2,
			updated: 1,
			documents: 0
		});

		const [updated] = await db.select().from(product).where(eq(product.id, old));
		expect(updated).toMatchObject({ price: 150, stockQty: 7, avgCost: 0 });
		const [scarf] = await db.select().from(product).where(eq(product.sku, 'GFT-2'));
		expect(scarf).toMatchObject({
			slug: 'silk-scarf',
			kind: 'gift',
			publishedAt: null,
			mainSupplierId: s,
			lowStockThreshold: 4,
			stockQty: 0
		});
		const [ribbon] = await db.select().from(product).where(eq(product.name, 'Ribbon'));
		expect(ribbon).toMatchObject({ kind: 'material', unit: 'm', avgCost: 12, price: null });
		const cats = await db.select().from(category);
		expect(cats.map((c) => c.name).sort()).toEqual(['Category 3', 'Materials', 'Scarves']);
	});

	it('finds every problem and writes nothing when there is one', async () => {
		await makeProduct({ barcode: '111' });
		const rows = sheet([
			{ name: '', price: '1' },
			{ name: 'A', kind: 'gadget', price: '1' },
			{ name: 'B', price: 'lots' },
			{ name: 'C', kind: 'gift' },
			{ name: 'D', kind: 'rental' },
			{ name: 'E', price: '5', supplier: 'Nobody' },
			{ name: 'F', price: '5', barcode: '111' },
			{ sku: 'X', name: 'G', price: '5' },
			{ sku: 'x', name: 'H', price: '5' },
			{ name: 'I', price: '5', taxCode: 'weird' },
			{ name: 'J', price: '5', trackLots: 'maybe' }
		]);
		const plan = await planImport('products', rows);
		expect(plan.rows.map((r) => r.errors.length > 0)).toEqual([
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			false,
			true,
			true,
			true
		]);
		expect(plan.rows[0].errors[0]).toMatch(/Name is missing/);
		await expect(runImport('products', rows, actor)).rejects.toThrow(/10 rows have a problem/);
		expect(await db.select().from(product).where(eq(product.name, 'G'))).toHaveLength(0);
	});

	it('gives duplicate names their own links', async () => {
		await runImport(
			'products',
			sheet([
				{ name: 'Rose', price: '10' },
				{ name: 'rose ', price: '11', sku: 'R2' }
			]),
			actor
		);
		const slugs = (await db.select({ slug: product.slug }).from(product)).map((p) => p.slug).sort();
		expect(slugs).toEqual(['rose', 'rose-2']);
	});
});

describe('suppliers', () => {
	it('creates and updates by name', async () => {
		await makeSupplier({ name: 'Old Supplier', phone: '0911000000' });
		const rows = sheet([
			{ name: 'old supplier', tin: '0012345678', vatRegistered: 'yes', leadTimeDays: '5' },
			{ name: 'New Supplier', phone: '0922111222' }
		]);
		expect(await runImport('suppliers', rows, actor)).toMatchObject({ created: 1, updated: 1 });
		const all = await db.select().from(supplier);
		expect(all.find((s) => s.name === 'Old Supplier')).toMatchObject({
			phone: '0911000000',
			tin: '0012345678',
			vatRegistered: true,
			leadTimeDays: 5
		});
	});

	it('needs a phone for a new supplier', async () => {
		const plan = await planImport('suppliers', sheet([{ name: 'No Phone' }]));
		expect(plan.rows[0].errors).toEqual(['A new supplier needs a phone number.']);
	});
});

describe('opening stock', () => {
	it('posts one opening adjustment per location, with cost and lots', async () => {
		const plain = await makeProduct({ sku: 'A1', stockQty: 0 });
		const lotted = await makeProduct({ sku: 'B1', stockQty: 0, trackLots: true });
		const rows = sheet([
			{ sku: 'A1', quantity: '12', unitCost: '30' },
			{ sku: 'B1', quantity: '6', lot: 'L1', expiry: '2099-01-01', unitCost: '10' }
		]);
		expect(await planImport('opening', rows)).toMatchObject({ problems: 0 });
		expect(await runImport('opening', rows, actor)).toMatchObject({ documents: 1 });
		expect(await stockOf(plain)).toBe(12);
		expect(await stockOf(lotted)).toBe(6);
		const [doc] = await db.select().from(stockDocument);
		expect(doc).toMatchObject({ type: 'adjustment', reason: 'opening', status: 'posted' });
		const [p] = await db.select().from(product).where(eq(product.id, plain));
		expect(p.avgCost).toBe(30);
	});

	it('refuses unknown products, missing lots and bad dates, and warns about stock already there', async () => {
		await makeProduct({ sku: 'A1', stockQty: 5 });
		await makeProduct({ sku: 'B1', stockQty: 0, trackLots: true });
		const plan = await planImport(
			'opening',
			sheet([
				{ sku: 'A1', quantity: '2' },
				{ sku: 'NOPE', quantity: '2' },
				{ sku: 'B1', quantity: '2' },
				{ sku: 'B1', quantity: '2', lot: 'L', expiry: '01/02/2030' },
				{ sku: 'A1', quantity: '0' },
				{ sku: 'A1', quantity: '2', location: 'Mars' }
			])
		);
		expect(plan.rows[0]).toMatchObject({
			errors: [],
			warnings: [expect.stringMatching(/already has 5/)]
		});
		expect(plan.rows.slice(1).every((r) => r.errors.length > 0)).toBe(true);
	});
});
