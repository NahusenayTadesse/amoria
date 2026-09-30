import { isNull } from 'drizzle-orm';
import type { FilenameColumn } from '@nahu/admin-kit/server/fileAudit';
import { db } from '$lib/server/db';
import { courseImage, packageImage, portfolioImage, productImage } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';

/**
 * Every column that holds a stored filename, for the kit's `auditFiles` (§5.0). A new file column
 * that is missing here makes its files look like orphans to the weekly audit.
 */
export const FILENAME_COLUMNS: readonly FilenameColumn[] = [
	['product_image', 'file_name'],
	['package_image', 'file_name'],
	['portfolio_image', 'file_name'],
	['course_image', 'file_name'],
	['payment', 'receipt_file']
];

/**
 * The names `/media/[name]` may serve to guests: the live rows of the four image tables (§5.2).
 * Everything else in the store — receipts above all — is private, and `/media` answers 404 for it.
 *
 * Cached as one set; the image actions call `invalidate('public-images')` (and a new image is at
 * worst a few minutes late on the storefront, never a private file early).
 */
export function isPublicFile(name: string): Promise<boolean> {
	return publicNames().then((names) => names.has(name));
}

function publicNames(): Promise<Set<string>> {
	return cached(
		'public-images',
		{ ttlMs: 5 * 60_000, tags: ['public-images', 'catalog'] },
		async () => {
			const tables = [productImage, packageImage, portfolioImage, courseImage];
			const lists = await Promise.all(
				tables.map((table) =>
					db.select({ name: table.fileName }).from(table).where(isNull(table.deletedAt))
				)
			);
			return new Set(lists.flat().map((row) => row.name));
		}
	);
}
