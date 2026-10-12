import { isNull } from 'drizzle-orm';
import type { FilenameColumn } from '@nahu/admin-kit/server/fileAudit';
import { db } from '$lib/server/db';
import {
	courseImage,
	packageImage,
	portfolioImage,
	productImage,
	bundleImage,
	rentalSpaceImage,
	renter,
	renterListingImage
} from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';

/**
 * Every column that holds a stored filename, for the kit's `auditFiles` (§5.0). A new file column
 * that is missing here makes its files look like orphans to the weekly audit.
 */
export const FILENAME_COLUMNS: readonly FilenameColumn[] = [
	['product_image', 'file_name'],
	['bundle_image', 'file_name'],
	['package_image', 'file_name'],
	['portfolio_image', 'file_name'],
	['course_image', 'file_name'],
	['rental_space_image', 'file_name'],
	['payment', 'receipt_file'],
	['renter_listing_image', 'file_name'],
	['renter', 'logo_file'],
	['renter', 'cover_file'],
	['renter', 'trade_licence_file'],
	['renter_payment', 'receipt_file']
];

/**
 * The names `/media/[name]` may serve to guests: the live rows of the image tables (§5.2).
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
			const tables = [
				productImage,
				bundleImage,
				packageImage,
				portfolioImage,
				courseImage,
				rentalSpaceImage,
				renterListingImage
			];
			const lists = await Promise.all([
				...tables.map((table) =>
					db.select({ name: table.fileName }).from(table).where(isNull(table.deletedAt))
				),
				// A renter's logo and cover are on their public page; their trade licence never is.
				db.select({ name: renter.logoFile }).from(renter),
				db.select({ name: renter.coverFile }).from(renter)
			]);
			return new Set(
				lists
					.flat()
					.map((row) => row.name)
					.filter((name): name is string => Boolean(name))
			);
		}
	);
}
