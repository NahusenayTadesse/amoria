import { contentCrud } from '@nahu/admin-kit/server/crud';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { category } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { categoryAdd, categoryEdit } from '$lib/schemas/catalog';
import { slugify } from '$lib/slug';
import { PRODUCT_KIND_LABELS } from '$lib/stock';

/** Gift and rental categories (§5.2): the shop's filter chips and `/shop/[category]`. */
const crud = contentCrud({
	table: category,
	label: 'Category',
	addSchema: categoryAdd,
	editSchema: categoryEdit,
	uniqueField: 'name',
	audit: 'category',
	transform: (values) => {
		values.slug = values.slug || slugify(values.name);
		if (!values.slug)
			throw new WriteRefused('slug', 'Give it a link name in Latin letters, e.g. flowers');
		values.nameAm = values.nameAm || null;
		return values;
	}
});

export const load = async () => {
	const page = await crud.load();
	return {
		...page,
		rows: page.rows.map((row) => ({
			...row,
			kindLabel: PRODUCT_KIND_LABELS[(row as { kind: string }).kind]
		}))
	};
};
export const actions = invalidating(['catalog'], crud.actions);
