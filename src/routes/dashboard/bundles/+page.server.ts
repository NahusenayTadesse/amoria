import { and, asc, eq, isNull } from 'drizzle-orm';
import { contentCrud } from '@nahu/admin-kit/server/crud';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { bundle, category, containerRule, product } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import {
	bundleContents,
	bundleIssues,
	categoryPaths,
	containerRules
} from '$lib/server/services/bundles';
import { bundleAdd, bundleEdit } from '$lib/schemas/catalog';
import { bundlePrice, bundleStock } from '$lib/bundle';
import { slugify } from '$lib/slug';

/** Gift categories only: a bundle is sold on the gift shop. */
async function giftCategoryOptions() {
	return db
		.select({ value: category.id, name: category.name })
		.from(category)
		.where(and(eq(category.kind, 'gift'), notDeleted(category)))
		.orderBy(asc(category.sortOrder), asc(category.name));
}

/** Gifts with rules: what a bundle can come in. */
async function containerOptions() {
	return db
		.selectDistinct({ value: product.id, name: product.name })
		.from(product)
		.innerJoin(
			containerRule,
			and(eq(containerRule.containerId, product.id), isNull(containerRule.deletedAt))
		)
		.where(and(eq(product.kind, 'gift'), notDeleted(product)))
		.orderBy(asc(product.name));
}

/**
 * Bundles: several gifts sold as one at a discount (§5.2). The name, text, discount and
 * visibility are the kit's `contentCrud`; what is in each, and its photos, are on its own page.
 * The price is never a form field: it is read off the contents.
 */
const crud = contentCrud({
	table: bundle,
	label: 'Bundle',
	addSchema: bundleAdd,
	editSchema: bundleEdit,
	uniqueField: 'slug',
	audit: 'bundle',
	references: [
		{
			field: 'categoryId',
			table: category,
			as: 'category',
			options: giftCategoryOptions,
			optionsKey: 'categoryList'
		},
		{
			field: 'containerId',
			table: product,
			as: 'container',
			options: containerOptions,
			optionsKey: 'containerList'
		}
	],
	transform: async (values, _event, before) => {
		const { published, ...row } = values;

		row.slug = row.slug || slugify(row.name);
		if (!row.slug)
			throw new WriteRefused('slug', 'Give it a link name in Latin letters, e.g. valentine-box');
		// The shop's links (`?product=`, `/buy/`) find gifts and bundles by the same name.
		const [clash] = await db
			.select({ name: product.name })
			.from(product)
			.where(and(eq(product.slug, row.slug), notDeleted(product)));
		if (clash) throw new WriteRefused('slug', `${clash.name} already uses that link name.`);

		row.categoryId ??= null;
		if (row.categoryId) {
			const [cat] = await db
				.select({ kind: category.kind })
				.from(category)
				.where(and(eq(category.id, row.categoryId), notDeleted(category)));
			if (cat?.kind !== 'gift') throw new WriteRefused('categoryId', 'Choose a gift category');
		}

		// A box the customer fills needs a container to fill; a staff bundle may come in one.
		row.containerId ??= null;
		if (row.type === 'custom' && !row.containerId) {
			throw new WriteRefused(
				'containerId',
				'Choose the box or basket customers fill. Give a gift rules on its page to make it one.'
			);
		}
		if (row.containerId) {
			const [rule] = await db
				.select({ id: containerRule.id })
				.from(containerRule)
				.where(and(eq(containerRule.containerId, row.containerId), isNull(containerRule.deletedAt)))
				.limit(1);
			if (!rule) {
				throw new WriteRefused(
					'containerId',
					'That gift has no rules yet. Add what fits in it on its page first.'
				);
			}
		}

		for (const key of ['nameAm', 'description', 'descriptionAm'] as const)
			row[key] = row[key] || null;

		// First publication stamps the date; unticking hides it.
		row.publishedAt = published ? (before?.publishedAt ?? new Date()) : null;
		return row;
	}
});

export const load = async () => {
	const page = await crud.load();
	const rows = page.rows as (typeof bundle.$inferSelect & { category: string | null })[];
	const [contents, rules, paths] = await Promise.all([
		bundleContents(rows),
		containerRules(rows.flatMap((row) => (row.containerId ? [row.containerId] : []))),
		categoryPaths()
	]);

	return {
		...page,
		rows: rows.map((row) => {
			const parts = contents.get(row.id) ?? [];
			const gifts = parts.filter((part) => !part.isContainer);
			const { offSale, problems } = bundleIssues(
				parts,
				row.containerId ? rules.get(row.containerId) : undefined,
				paths
			);
			const custom = row.type === 'custom';
			return {
				...row,
				published: row.publishedAt !== null,
				kindLabel: custom ? 'Built by customers' : 'Ready-made',
				itemCount: custom ? null : gifts.length,
				price: !custom && gifts.length ? bundlePrice(parts, row.discountPercent) : null,
				sets: offSale.length || problems.length ? 0 : bundleStock(parts),
				broken: offSale.length > 0 || problems.length > 0
			};
		})
	};
};

export const actions = invalidating(['catalog', 'public-images'], crud.actions);
