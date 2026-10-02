/**
 * Bulk import from a spreadsheet: products, suppliers and opening stock — what the shop already
 * has in Excel on the day it starts using the system.
 *
 * Two steps. `planImport` reads every row and says what would happen to it (create, update) and
 * what is wrong with it, writing nothing. `runImport` plans again inside the transaction — the
 * preview is never trusted — and writes everything or nothing: one bad row stops the lot, so a
 * half-imported catalogue never has to be untangled.
 *
 * Opening stock becomes one posted adjustment per location (reason: opening), through the ordinary
 * posting service, so lots, expiry dates and average cost come out as any delivery would.
 * Imported products are created *unpublished*: they appear on the storefront only when staff add a
 * photo and publish them.
 */
import { eq, like, sql } from 'drizzle-orm';
import { readSheet } from 'read-excel-file/node';
import Papa from 'papaparse';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { invalidate } from '$lib/server/cache';
import { category, location, product, supplier } from '$lib/server/db/schema';
import { PRODUCT_KINDS, TAX_CODES } from '$lib/constants';
import { roundBirr } from '$lib/money';
import { slugify } from '$lib/slug';
import { round4 } from '$lib/stockMath';
import type { Actor } from '../payments/payable';
import { getSettings } from '../settings';
import { saveDocumentInTx } from './documents';
import { defaultPlace, places } from './ledger';
import { postInTx } from './post';

export const IMPORT_KINDS = ['products', 'suppliers', 'opening'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const MAX_ROWS = 5000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** A refusal of the whole import, said to the person importing. */
export class ImportError extends Error {}

type Column = { key: string; label: string; aliases?: string[]; sample: string; note?: string };

/**
 * The columns each kind reads, in template order. Headers are matched ignoring case, spaces,
 * dashes and underscores, against the key, the label and the aliases.
 */
export const COLUMNS: Record<ImportKind, Column[]> = {
	products: [
		{ key: 'sku', label: 'SKU', aliases: ['code', 'product code'], sample: 'GFT-001' },
		{
			key: 'name',
			label: 'Name',
			aliases: ['product', 'product name', 'item'],
			sample: 'Silk scarf'
		},
		{ key: 'nameAm', label: 'Name (Amharic)', aliases: ['name am', 'amharic'], sample: 'የሐር ሻርፕ' },
		{
			key: 'kind',
			label: 'Kind',
			aliases: ['type'],
			sample: 'gift',
			note: 'gift, rental or material. Blank: gift'
		},
		{
			key: 'category',
			label: 'Category',
			sample: 'Scarves',
			note: 'Made if new. Blank: Gifts, Rental equipment or Materials'
		},
		{ key: 'unit', label: 'Unit', aliases: ['uom', 'counted in'], sample: 'pcs' },
		{
			key: 'price',
			label: 'Price',
			aliases: ['sale price', 'selling price'],
			sample: '850',
			note: 'Gifts'
		},
		{
			key: 'dailyRate',
			label: 'Daily rate',
			aliases: ['rate', 'per day'],
			sample: '',
			note: 'Rental equipment'
		},
		{
			key: 'cost',
			label: 'Cost',
			aliases: ['unit cost', 'buying price'],
			sample: '500',
			note: 'Starting cost for new products'
		},
		{
			key: 'taxCode',
			label: 'VAT',
			aliases: ['tax code', 'tax'],
			sample: 'standard',
			note: 'standard, zero or exempt'
		},
		{
			key: 'supplier',
			label: 'Main supplier',
			aliases: ['supplier'],
			sample: 'Habesha Wholesale',
			note: 'Must be on the supplier list'
		},
		{ key: 'reorderLevel', label: 'Reorder level', aliases: ['reorder at', 'min'], sample: '5' },
		{
			key: 'trackLots',
			label: 'Track lots',
			aliases: ['lots', 'expiry'],
			sample: 'no',
			note: 'yes for anything that expires'
		},
		{ key: 'barcode', label: 'Barcode', aliases: ['ean', 'upc'], sample: '' }
	],
	suppliers: [
		{ key: 'name', label: 'Name', aliases: ['supplier'], sample: 'Habesha Wholesale' },
		{ key: 'phone', label: 'Phone', aliases: ['mobile', 'telephone'], sample: '0911 234 567' },
		{ key: 'email', label: 'Email', sample: 'sales@example.com' },
		{ key: 'address', label: 'Address', sample: 'Merkato, Addis Ababa' },
		{ key: 'tin', label: 'TIN', sample: '0000123456' },
		{ key: 'vatRegistered', label: 'VAT registered', aliases: ['vat'], sample: 'yes' },
		{ key: 'leadTimeDays', label: 'Lead time days', aliases: ['lead time'], sample: '7' }
	],
	opening: [
		{ key: 'sku', label: 'SKU', aliases: ['code', 'product code'], sample: 'GFT-001' },
		{ key: 'name', label: 'Name', aliases: ['product'], sample: '', note: 'When there is no SKU' },
		{
			key: 'location',
			label: 'Location',
			aliases: ['store', 'where'],
			sample: 'Shop floor',
			note: 'Blank: the shop floor'
		},
		{ key: 'quantity', label: 'Quantity', aliases: ['qty', 'on hand'], sample: '24' },
		{ key: 'unitCost', label: 'Unit cost', aliases: ['cost'], sample: '500' },
		{ key: 'lot', label: 'Lot', aliases: ['lot number', 'batch'], sample: '' },
		{
			key: 'expiry',
			label: 'Expiry',
			aliases: ['expiry date', 'expires'],
			sample: '',
			note: 'YYYY-MM-DD'
		}
	]
};

// ── Reading the file ────────────────────────────────────────────────────────────────────────

const headerKey = (h: string) => h.toLowerCase().replace(/[\s_\-.()]+/g, '');

/** A cell as text: Excel dates as `YYYY-MM-DD`, numbers without float noise. */
function cellText(v: unknown): string {
	if (v === null || v === undefined) return '';
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	if (typeof v === 'number') return String(round4(v));
	if (typeof v === 'boolean') return v ? 'yes' : 'no';
	return String(v).trim();
}

export type SheetRow = { row: number; values: Record<string, string> };

/**
 * The file as rows keyed by column (`sku`, `name`...). Row numbers are the spreadsheet's, header
 * being row 1, so a message can point at the line to fix. Unknown columns are reported, not used.
 */
export async function readTable(
	kind: ImportKind,
	file: { name: string; bytes: Uint8Array }
): Promise<{ rows: SheetRow[]; ignored: string[] }> {
	if (file.bytes.byteLength > MAX_FILE_BYTES) {
		throw new ImportError('That file is over 5 MB. Split it and import it in parts.');
	}
	let table: string[][];
	const name = file.name.toLowerCase();
	if (name.endsWith('.xlsx')) {
		try {
			const data = await readSheet(Buffer.from(file.bytes));
			table = data.map((r) => r.map(cellText));
		} catch {
			throw new ImportError('That Excel file could not be read. Save it again as .xlsx or .csv.');
		}
	} else if (name.endsWith('.csv') || name.endsWith('.txt')) {
		// Excel writes a byte-order mark, and semicolons when set to a European locale.
		const text = new TextDecoder('utf-8').decode(file.bytes).replace(/^\uFEFF/, '');
		const first = text.split(/\r?\n/, 1)[0] ?? '';
		const delimiter =
			(first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
		const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
		table = parsed.data.map((r) => r.map((c) => String(c ?? '').trim()));
	} else {
		throw new ImportError('Choose an Excel (.xlsx) or CSV file.');
	}

	const nonEmpty = (r: string[]) => r.some((c) => c.trim() !== '');
	const headerIndex = table.findIndex(nonEmpty);
	if (headerIndex === -1) throw new ImportError('That file is empty.');
	const header = table[headerIndex].map(headerKey);

	const byHeader = new Map<string, string>();
	for (const col of COLUMNS[kind]) {
		for (const alias of [col.key, col.label, ...(col.aliases ?? [])]) {
			byHeader.set(headerKey(alias), col.key);
		}
	}
	const keys = header.map((h) => byHeader.get(h) ?? null);
	if (!keys.some(Boolean)) {
		throw new ImportError(`No column heading was recognised for ${kind}. Start from the template.`);
	}
	const ignored = table[headerIndex].filter((h, i) => h.trim() && !keys[i]);

	const rows: SheetRow[] = [];
	for (let i = headerIndex + 1; i < table.length; i++) {
		if (!nonEmpty(table[i])) continue;
		const values: Record<string, string> = {};
		keys.forEach((k, j) => {
			if (k && values[k] === undefined) values[k] = (table[i][j] ?? '').trim();
		});
		rows.push({ row: i + 1, values });
	}
	if (!rows.length) throw new ImportError('The file has headings but no rows.');
	if (rows.length > MAX_ROWS) {
		throw new ImportError(`${rows.length} rows is over the limit of ${MAX_ROWS} a file.`);
	}
	return { rows, ignored };
}

/** A template: the header row and one sample row. */
export function templateCsv(kind: ImportKind): string {
	const cols = COLUMNS[kind];
	return Papa.unparse([cols.map((c) => c.label), cols.map((c) => c.sample)]);
}

// ── Planning ────────────────────────────────────────────────────────────────────────────────

export type PlannedRow = {
	row: number;
	action: 'create' | 'update';
	label: string;
	errors: string[];
	warnings: string[];
};
export type Plan = {
	kind: ImportKind;
	rows: PlannedRow[];
	problems: number;
	creates: number;
	updates: number;
};

const YES = new Set(['yes', 'y', 'true', '1', 'x']);
const NO = new Set(['no', 'n', 'false', '0', '']);
const flag = (v: string | undefined): boolean | null => {
	const t = (v ?? '').trim().toLowerCase();
	return YES.has(t) ? true : NO.has(t) ? false : null;
};
const num = (v: string | undefined): number | null => {
	const t = (v ?? '').replace(/[, ]/g, '');
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : NaN;
};
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const DEFAULT_CATEGORY = {
	gift: 'Gifts',
	rental: 'Rental equipment',
	material: 'Materials'
} as const;

/** What would happen to every row, and what is wrong with it. Writes nothing. */
export async function planImport(
	kind: ImportKind,
	rows: SheetRow[],
	reader: Writer = db
): Promise<Plan> {
	const planned: PlannedRow[] =
		kind === 'products'
			? await planProducts(rows, reader)
			: kind === 'suppliers'
				? await planSuppliers(rows, reader)
				: await planOpening(rows, reader);
	return {
		kind,
		rows: planned,
		problems: planned.filter((r) => r.errors.length).length,
		creates: planned.filter((r) => r.action === 'create').length,
		updates: planned.filter((r) => r.action === 'update').length
	};
}

const lower = (s: string) => s.trim().toLowerCase();

async function planProducts(rows: SheetRow[], reader: Writer): Promise<PlannedRow[]> {
	const [products, suppliers] = await Promise.all([
		reader
			.select({ id: product.id, sku: product.sku, name: product.name, barcode: product.barcode })
			.from(product)
			.where(sql`${product.deletedAt} IS NULL`),
		reader
			.select({ name: supplier.name })
			.from(supplier)
			.where(sql`${supplier.deletedAt} IS NULL`)
	]);
	const bySku = new Map(products.filter((p) => p.sku).map((p) => [lower(p.sku!), p]));
	const byName = new Map(products.map((p) => [lower(p.name), p]));
	const supplierNames = new Set(suppliers.map((s) => lower(s.name)));
	const barcodeOwner = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode!, p.id]));
	const seenSku = new Set<string>();
	const seenBarcode = new Set<string>();

	return rows.map(({ row, values: v }) => {
		const errors: string[] = [];
		const warnings: string[] = [];
		const name = v.name ?? '';
		if (!name) errors.push('Name is missing.');

		const existing = v.sku ? bySku.get(lower(v.sku)) : byName.get(lower(name));
		const action = existing ? ('update' as const) : ('create' as const);

		if (v.sku) {
			if (seenSku.has(lower(v.sku))) errors.push(`SKU ${v.sku} appears twice in this file.`);
			seenSku.add(lower(v.sku));
		}
		const kind = (v.kind ?? '').trim().toLowerCase() || 'gift';
		if (!(PRODUCT_KINDS as readonly string[]).includes(kind)) {
			errors.push(`Kind "${v.kind}" is not gift, rental or material.`);
		}
		const price = num(v.price);
		const daily = num(v.dailyRate);
		if (Number.isNaN(price) || (price !== null && price < 0))
			errors.push('Price is not a valid amount.');
		if (Number.isNaN(daily) || (daily !== null && daily < 0))
			errors.push('Daily rate is not a valid amount.');
		if (!existing) {
			if (kind === 'gift' && price === null) errors.push('A gift needs a price.');
			if (kind === 'rental' && daily === null) errors.push('Rental equipment needs a daily rate.');
		}
		const cost = num(v.cost);
		if (Number.isNaN(cost) || (cost !== null && cost < 0))
			errors.push('Cost is not a valid amount.');
		if (v.taxCode && !TAX_CODES.includes(taxCode(v.taxCode) as never)) {
			errors.push(`VAT "${v.taxCode}" is not standard, zero or exempt.`);
		}
		const reorder = num(v.reorderLevel);
		if (
			Number.isNaN(reorder) ||
			(reorder !== null && (reorder < 0 || !Number.isInteger(reorder)))
		) {
			errors.push('Reorder level is a whole number, zero or more.');
		}
		if (flag(v.trackLots) === null) errors.push('Track lots is yes or no.');
		if (v.supplier && !supplierNames.has(lower(v.supplier))) {
			errors.push(`Supplier "${v.supplier}" is not on the supplier list. Import suppliers first.`);
		}
		if (v.barcode) {
			const owner = barcodeOwner.get(v.barcode);
			if (owner && owner !== existing?.id)
				errors.push(`Barcode ${v.barcode} belongs to another product.`);
			if (seenBarcode.has(v.barcode))
				errors.push(`Barcode ${v.barcode} appears twice in this file.`);
			seenBarcode.add(v.barcode);
		}
		if (existing && cost !== null)
			warnings.push('Cost is only used for new products; stock keeps its own average.');
		return { row, action, label: name || `Row ${row}`, errors, warnings };
	});
}

const taxCode = (v: string) => {
	const t = v.trim().toLowerCase();
	return t === 'vat' || t === 'standard' || t === '15' ? 'standard' : t === '0' ? 'zero' : t;
};

async function planSuppliers(rows: SheetRow[], reader: Writer): Promise<PlannedRow[]> {
	const existing = await reader
		.select({ id: supplier.id, name: supplier.name })
		.from(supplier)
		.where(sql`${supplier.deletedAt} IS NULL`);
	const byName = new Map(existing.map((s) => [lower(s.name), s.id]));
	const seen = new Set<string>();
	return rows.map(({ row, values: v }) => {
		const errors: string[] = [];
		const name = v.name ?? '';
		if (!name) errors.push('Name is missing.');
		if (name && seen.has(lower(name))) errors.push(`${name} appears twice in this file.`);
		seen.add(lower(name));
		const found = byName.get(lower(name));
		if (!found && !v.phone) errors.push('A new supplier needs a phone number.');
		if (flag(v.vatRegistered) === null) errors.push('VAT registered is yes or no.');
		const lead = num(v.leadTimeDays);
		if (Number.isNaN(lead) || (lead !== null && (lead < 0 || !Number.isInteger(lead)))) {
			errors.push('Lead time is a whole number of days.');
		}
		return {
			row,
			action: found ? 'update' : 'create',
			label: name || `Row ${row}`,
			errors,
			warnings: []
		};
	});
}

async function planOpening(rows: SheetRow[], reader: Writer): Promise<PlannedRow[]> {
	const [products, locations] = await Promise.all([
		reader
			.select({
				id: product.id,
				sku: product.sku,
				name: product.name,
				trackLots: product.trackLots,
				stockQty: product.stockQty
			})
			.from(product)
			.where(sql`${product.deletedAt} IS NULL`),
		reader
			.select({ id: location.id, name: location.name, kind: location.kind })
			.from(location)
			.where(sql`${location.deletedAt} IS NULL`)
	]);
	const bySku = new Map(products.filter((p) => p.sku).map((p) => [lower(p.sku!), p]));
	const byName = new Map(products.map((p) => [lower(p.name), p]));
	const locByName = new Map(locations.map((l) => [lower(l.name), l]));

	return rows.map(({ row, values: v }) => {
		const errors: string[] = [];
		const warnings: string[] = [];
		const p = v.sku ? bySku.get(lower(v.sku)) : v.name ? byName.get(lower(v.name)) : undefined;
		if (!p)
			errors.push(
				v.sku || v.name ? `Product "${v.sku || v.name}" was not found.` : 'SKU or name is missing.'
			);
		if (v.location) {
			const loc = locByName.get(lower(v.location));
			if (!loc) errors.push(`Location "${v.location}" does not exist.`);
			else if (loc.kind === 'quarantine') errors.push('Opening stock cannot go into quarantine.');
		}
		const qty = num(v.quantity);
		if (qty === null || Number.isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
			errors.push('Quantity is a whole number above zero.');
		}
		const cost = num(v.unitCost);
		if (Number.isNaN(cost) || (cost !== null && cost < 0))
			errors.push('Unit cost is not a valid amount.');
		if (v.expiry && !isDay(v.expiry)) errors.push('Expiry is a date written YYYY-MM-DD.');
		if (p?.trackLots && !v.lot) errors.push(`${p.name} tracks lots: give the lot number.`);
		if (p && !p.trackLots && v.lot)
			errors.push(`${p.name} does not track lots; leave the lot blank.`);
		if (p && p.stockQty > 0)
			warnings.push(`${p.name} already has ${p.stockQty} in stock; this adds to it.`);
		return { row, action: 'create', label: p?.name ?? `Row ${row}`, errors, warnings };
	});
}

// ── Running ─────────────────────────────────────────────────────────────────────────────────

export type ImportResult = { created: number; updated: number; documents: number };

/**
 * Applies an import: plans again, refuses if any row has a problem, then writes everything in one
 * transaction (posting the opening-stock documents in it).
 */
export async function runImport(
	kind: ImportKind,
	rows: SheetRow[],
	actor: Actor
): Promise<ImportResult> {
	const settings = await getSettings();
	const result = await transaction(async (tx) => {
		const plan = await planImport(kind, rows, tx);
		if (plan.problems) {
			throw new ImportError(
				`${plan.problems} row${plan.problems === 1 ? ' has' : 's have'} a problem, so nothing was imported. Fix them and try again.`
			);
		}
		const done =
			kind === 'products'
				? await writeProducts(tx, rows, actor)
				: kind === 'suppliers'
					? await writeSuppliers(tx, rows, actor)
					: await writeOpening(tx, rows, actor, settings);
		await recordAudit(tx, actor, {
			table: 'import',
			recordId: kind,
			action: 'create',
			after: { rows: rows.length, ...done }
		});
		return done;
	});
	invalidate('catalog');
	return result;
}

async function uniqueSlug(tx: Writer, table: typeof product | typeof category, base: string) {
	const slug = base || 'item';
	const taken = new Set(
		(
			await tx
				.select({ slug: table.slug })
				.from(table)
				.where(like(table.slug, `${slug}%`))
		).map((r) => r.slug)
	);
	if (!taken.has(slug)) return slug;
	for (let n = 2; ; n++) if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
}

async function writeProducts(tx: Writer, rows: SheetRow[], actor: Actor): Promise<ImportResult> {
	const me = actor.locals.user?.id ?? null;
	const suppliers = new Map(
		(await tx.select({ id: supplier.id, name: supplier.name }).from(supplier)).map((s) => [
			lower(s.name),
			s.id
		])
	);
	const categories = new Map(
		(
			await tx.select({ id: category.id, kind: category.kind, name: category.name }).from(category)
		).map((c) => [`${c.kind}:${lower(c.name)}`, c.id])
	);
	const existing = await tx
		.select({ id: product.id, sku: product.sku, name: product.name })
		.from(product)
		.where(sql`${product.deletedAt} IS NULL`);
	const bySku = new Map(existing.filter((p) => p.sku).map((p) => [lower(p.sku!), p.id]));
	const byName = new Map(existing.map((p) => [lower(p.name), p.id]));

	let created = 0;
	let updated = 0;
	for (const { values: v } of rows) {
		const kind = ((v.kind ?? '').trim().toLowerCase() || 'gift') as (typeof PRODUCT_KINDS)[number];
		const id = v.sku ? bySku.get(lower(v.sku)) : byName.get(lower(v.name));
		// A category is needed to create a product, or when an update names one.
		let categoryId: number | undefined;
		if (!id || v.category) {
			const catName = v.category || DEFAULT_CATEGORY[kind];
			categoryId = categories.get(`${kind}:${lower(catName)}`);
			if (!categoryId) {
				categoryId = (
					await tx
						.insert(category)
						.values({ kind, name: catName, slug: await uniqueSlug(tx, category, slugify(catName)) })
						.$returningId()
				)[0].id;
				categories.set(`${kind}:${lower(catName)}`, categoryId);
			}
		}

		const price = num(v.price);
		const daily = num(v.dailyRate);
		const reorder = num(v.reorderLevel);
		const fields = {
			...(v.nameAm ? { nameAm: v.nameAm } : {}),
			...(v.unit ? { unit: v.unit } : {}),
			...(price !== null ? { price: roundBirr(price) } : {}),
			...(daily !== null ? { dailyRate: roundBirr(daily) } : {}),
			...(v.taxCode ? { taxCode: taxCode(v.taxCode) as (typeof TAX_CODES)[number] } : {}),
			...(v.supplier ? { mainSupplierId: suppliers.get(lower(v.supplier)) } : {}),
			...(reorder !== null ? { lowStockThreshold: reorder } : {}),
			...(v.trackLots ? { trackLots: flag(v.trackLots) ?? false } : {}),
			...(v.barcode ? { barcode: v.barcode } : {}),
			...(v.category ? { categoryId } : {})
		};

		if (id) {
			await tx
				.update(product)
				.set({ ...(v.name && v.sku ? { name: v.name } : {}), ...fields, updatedBy: me })
				.where(eq(product.id, id));
			updated += 1;
		} else {
			const cost = num(v.cost);
			const [{ id: newId }] = await tx
				.insert(product)
				.values({
					kind,
					categoryId: categoryId!,
					slug: await uniqueSlug(tx, product, slugify(v.name) || slugify(v.sku ?? '') || 'product'),
					name: v.name,
					sku: v.sku || null,
					price: kind === 'gift' ? roundBirr(price ?? 0) : null,
					dailyRate: kind === 'rental' ? roundBirr(daily ?? 0) : null,
					avgCost: cost ?? 0,
					...fields,
					// Unpublished until staff add a photo and publish it.
					publishedAt: null,
					createdBy: me,
					updatedBy: me
				})
				.$returningId();
			if (v.sku) bySku.set(lower(v.sku), newId);
			byName.set(lower(v.name), newId);
			created += 1;
		}
	}
	return { created, updated, documents: 0 };
}

async function writeSuppliers(tx: Writer, rows: SheetRow[], actor: Actor): Promise<ImportResult> {
	const me = actor.locals.user?.id ?? null;
	const existing = new Map(
		(await tx.select({ id: supplier.id, name: supplier.name }).from(supplier)).map((s) => [
			lower(s.name),
			s.id
		])
	);
	let created = 0;
	let updated = 0;
	for (const { values: v } of rows) {
		const lead = num(v.leadTimeDays);
		const fields = {
			...(v.phone ? { phone: v.phone } : {}),
			...(v.email ? { email: v.email } : {}),
			...(v.address ? { address: v.address } : {}),
			...(v.tin ? { tin: v.tin } : {}),
			...(v.vatRegistered ? { vatRegistered: flag(v.vatRegistered) ?? false } : {}),
			...(lead !== null ? { leadTimeDays: lead } : {})
		};
		const id = existing.get(lower(v.name));
		if (id) {
			await tx
				.update(supplier)
				.set({ ...fields, updatedBy: me })
				.where(eq(supplier.id, id));
			updated += 1;
		} else {
			const [{ id: newId }] = await tx
				.insert(supplier)
				.values({ name: v.name, phone: v.phone, ...fields, createdBy: me, updatedBy: me })
				.$returningId();
			existing.set(lower(v.name), newId);
			created += 1;
		}
	}
	return { created, updated, documents: 0 };
}

async function writeOpening(
	tx: Writer,
	rows: SheetRow[],
	actor: Actor,
	settings: Awaited<ReturnType<typeof getSettings>>
): Promise<ImportResult> {
	const products = await tx
		.select({ id: product.id, sku: product.sku, name: product.name })
		.from(product)
		.where(sql`${product.deletedAt} IS NULL`);
	const bySku = new Map(products.filter((p) => p.sku).map((p) => [lower(p.sku!), p.id]));
	const byName = new Map(products.map((p) => [lower(p.name), p.id]));
	const list = await places(tx);
	const locations = new Map(
		(await tx.select({ id: location.id, name: location.name }).from(location)).map((l) => [
			lower(l.name),
			l.id
		])
	);
	const shop = defaultPlace(list).id;

	const perLocation = new Map<number, SheetRow['values'][]>();
	for (const { values: v } of rows) {
		const locationId = v.location ? locations.get(lower(v.location))! : shop;
		perLocation.set(locationId, [...(perLocation.get(locationId) ?? []), v]);
	}
	let documents = 0;
	for (const [locationId, entries] of perLocation) {
		const id = await saveDocumentInTx(
			tx,
			{
				header: {
					type: 'adjustment',
					docDate: localToday(),
					fromLocationId: locationId,
					reason: 'opening',
					reference: 'Opening stock import'
				},
				lines: entries.map((v) => ({
					productId: (v.sku ? bySku.get(lower(v.sku)) : byName.get(lower(v.name)))!,
					quantity: Number(num(v.quantity)),
					unitCost: num(v.unitCost),
					lotNumber: v.lot || null,
					expiryDate: v.expiry || null
				}))
			},
			actor
		);
		await postInTx(tx, id, actor, settings);
		documents += 1;
	}
	return { created: 0, updated: 0, documents };
}
