/**
 * Picker options for the dashboard forms, as the kit's `{ value, name }` lists. Only live rows;
 * each helper is one small query so a page loads just the pickers it shows.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { category, location, product, quote, stockLot, supplier } from '$lib/server/db/schema';

export type Option = { value: number; name: string };

/** Products to pick from, "Name (SKU)". `kinds` narrows to what the screen can use. */
export async function productOptions(
	kinds?: readonly ('gift' | 'rental' | 'material')[]
): Promise<Option[]> {
	const rows = await db
		.select({ value: product.id, name: product.name, sku: product.sku, kind: product.kind })
		.from(product)
		.where(sql`${product.deletedAt} IS NULL`)
		.orderBy(asc(product.name));
	return rows
		.filter((r) => !kinds || kinds.includes(r.kind))
		.map((r) => ({ value: r.value, name: r.sku ? `${r.name} (${r.sku})` : r.name }));
}

/** Locations, with quarantine left out when the screen is about stock in use. */
export async function locationOptions(
	options: { withQuarantine?: boolean } = {}
): Promise<Option[]> {
	const rows = await db
		.select({ value: location.id, name: location.name, kind: location.kind })
		.from(location)
		.where(and(eq(location.status, true), sql`${location.deletedAt} IS NULL`))
		.orderBy(asc(location.sortOrder), asc(location.id));
	return rows
		.filter((r) => options.withQuarantine || r.kind !== 'quarantine')
		.map(({ value, name }) => ({ value, name }));
}

export async function supplierOptions(): Promise<Option[]> {
	return db
		.select({ value: supplier.id, name: supplier.name })
		.from(supplier)
		.where(and(eq(supplier.isActive, true), sql`${supplier.deletedAt} IS NULL`))
		.orderBy(asc(supplier.name));
}

export async function categoryOptions(): Promise<Option[]> {
	return db
		.select({ value: category.id, name: category.name })
		.from(category)
		.where(and(eq(category.status, true), sql`${category.deletedAt} IS NULL`))
		.orderBy(asc(category.kind), asc(category.name));
}

/** Lots as "LOT-7 (expires 2026-12-01)", for the product or for every product. */
export async function lotOptions(productId?: number): Promise<Option[]> {
	const rows = await db
		.select({
			value: stockLot.id,
			lot: stockLot.lotNumber,
			expiry: stockLot.expiryDate,
			product: product.name
		})
		.from(stockLot)
		.innerJoin(product, eq(product.id, stockLot.productId))
		.where(productId ? eq(stockLot.productId, productId) : undefined)
		.orderBy(asc(product.name), asc(stockLot.expiryDate));
	return rows.map((r) => ({
		value: r.value,
		name: `${productId ? '' : `${r.product}: `}${r.lot}${r.expiry ? ` (expires ${r.expiry})` : ''}`
	}));
}

/** Décor jobs a requisition can be for: quotes that are booked or being quoted. */
export async function quoteOptions(): Promise<Option[]> {
	const rows = await db
		.select({ value: quote.id, ref: quote.ref, name: quote.contactName, day: quote.eventDate })
		.from(quote)
		.where(sql`${quote.status} IN ('accepted', 'deposit_paid', 'paid')`)
		.orderBy(asc(quote.eventDate));
	return rows.map((r) => ({
		value: r.value,
		name: `${r.ref ?? `Quote ${r.value}`}: ${r.name}${r.day ? `, ${r.day}` : ''}`
	}));
}
