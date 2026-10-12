import { z } from 'zod/v4';

/**
 * A record's photo gallery in the dashboard (products, rental spaces): several photos added at
 * once, and each one's file replaced or caption changed on its own. Order is not on these forms;
 * it moves only through the gallery's arrows and "Make main", so a caption edit never reshuffles.
 */

const optionalText = (max: number) =>
	z.preprocess((v) => (v === null || v === undefined ? '' : v), z.string().trim().max(max));

/** A photo. Compressed in the browser by the kit's `FileUpload`/`GalleryUpload` (≤1 MB, ≤1920 px). */
const photo = z
	.instanceof(File, { message: 'Choose a photo' })
	.refine((f) => f.size > 0, 'Choose a photo')
	.refine((f) => f.size <= 10 * 1024 * 1024, 'Up to 10 MB')
	.refine((f) => f.type.startsWith('image/'), 'A photo, not a document');

/** Several photos at once; each becomes a row after the ones already there. */
export const photosAdd = z.object({
	images: z.array(photo).min(1, 'Choose at least one photo').default([])
});

/** One photo: a new file replaces the stored one; none keeps it. */
export const photoEdit = z.object({
	id: z.coerce.number(),
	fileName: photo.optional(),
	alt: optionalText(160),
	altAm: optionalText(160)
});
