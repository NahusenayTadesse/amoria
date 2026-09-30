import { and, asc, eq } from 'drizzle-orm';
import { contentCrud } from '@nahu/admin-kit/server/crud';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { category, product } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { productAdd, productEdit } from '$lib/schemas/catalog';
import { slugify } from '$lib/slug';
import { PRODUCT_KIND_LABELS } from '$lib/stock';

/** "Gift: Flowers" — the kind is part of the choice, since a product and its category must agree. */
async function categoryOptions() {
	const rows = await db
		.select({ value: category.id, name: category.name, kind: category.kind })
		.from(category)
		.where(notDeleted(category))
		.orderBy(asc(category.kind), asc(category.sortOrder), asc(category.name));
	return rows.map((c) => ({ value: c.value, name: `${PRODUCT_KIND_LABELS[c.kind]}: ${c.name}` }));
}

/**
 * Gifts and rental equipment in one list (§5.2) — the kit's `contentCrud`, with what the form must
 * never decide done here: `stockQty` is not a form field and is dropped if posted (only
 * `stock.move()` writes it), the storefront link is made from the name when left empty, and the
 * product's kind must match its category's.
 */
const crud = contentCrud({
	table: product,
	label: 'Product',
	addSchema: productAdd,
	editSchema: productEdit,
	uniqueField: 'slug',
	audit: 'product',
	references: [
		{
			field: 'categoryId',
			table: category,
			as: 'category',
			options: categoryOptions,
			optionsKey: 'categoryList'
		}
	],
	transform: async (values, _event, before) => {
		const { published, ...row } = values;
		// Never from the form: only `stock.move()` writes stock.
		delete row.stockQty;

		const [cat] = await db
			.select({ kind: category.kind })
			.from(category)
			.where(and(eq(category.id, row.categoryId), notDeleted(category)));
		if (!cat) throw new WriteRefused('categoryId', 'Choose a category');
		if (cat.kind !== row.kind) {
			throw new WriteRefused(
				'categoryId',
				`That is a ${PRODUCT_KIND_LABELS[cat.kind].toLowerCase()} category; pick one for ${PRODUCT_KIND_LABELS[row.kind].toLowerCase()}s.`
			);
		}

		row.slug = row.slug || slugify(row.name);
		if (!row.slug)
			throw new WriteRefused('slug', 'Give it a link name in Latin letters, e.g. red-rose-box');

		// Only the price that applies to the kind is kept.
		if (row.kind === 'gift') row.dailyRate = null;
		else row.price = null;

		for (const key of ['nameAm', 'description', 'descriptionAm'] as const)
			row[key] = row[key] || null;
		row.lowStockThreshold ??= null;
		row.price ??= null;
		row.dailyRate ??= null;

		// First publication stamps the date ("new arrival" is read off it); unticking hides it.
		row.publishedAt = published ? (before?.publishedAt ?? new Date()) : null;
		return row;
	}
});

export const load = async () => {
	const page = await crud.load();
	return {
		...page,
		rows: (page.rows as (typeof product.$inferSelect & { category: string })[]).map((row) => ({
			...row,
			published: row.publishedAt !== null,
			kindLabel: PRODUCT_KIND_LABELS[row.kind]
		}))
	};
};

export const actions = invalidating(['catalog', 'public-images'], crud.actions);
