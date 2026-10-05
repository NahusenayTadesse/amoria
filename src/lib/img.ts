import { asset } from '$app/paths';

/**
 * `srcset` for a photo that has a smaller copy beside it (`photo.webp` and `photo-480.webp`, made
 * by ImageMagick in `scripts/demo-images.sh` and for the shop photos), so a phone downloads the
 * small one. `sizes` tells the browser how wide the picture is shown; the default is full width
 * on phones, half of it from the `sm` breakpoint.
 */
export function responsive(path: string, small: number, full: number) {
	const base = path.replace(/\.webp$/, '');
	return {
		src: asset(path),
		srcset: `${asset(`${base}-${small}.webp`)} ${small}w, ${asset(path)} ${full}w`
	};
}
