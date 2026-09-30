/**
 * A URL slug from a name: `Red Rose Bouquet` → `red-rose-bouquet`. Latin letters and digits only;
 * an Amharic-only name gives an empty slug, which the caller replaces (a product needs an English
 * name for its link anyway).
 */
export function slugify(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 150);
}
