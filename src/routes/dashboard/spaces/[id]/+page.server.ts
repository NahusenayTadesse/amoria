import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { rentalSpace, rentalSpaceImage } from '$lib/server/db/schema';
import { photoGallery } from '$lib/server/photoGallery';

/**
 * One space's photos and video. The space's own fields are edited on the list page; here staff
 * manage the main photo and the gallery, and see the video as guests do.
 */
const photos = photoGallery({
	table: rentalSpaceImage,
	ownerColumn: 'spaceId',
	permission: 'catalog.manage',
	audit: 'rental_space_image'
});

function spaceId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Space not found');
	return id;
}

/** The space in the address, which must exist: its photo actions have nothing to add to otherwise. */
async function current(id: number) {
	const [row] = await db
		.select()
		.from(rentalSpace)
		.where(and(eq(rentalSpace.id, id), notDeleted(rentalSpace)));
	if (!row) error(404, 'Space not found');
	return row;
}

async function existingId(params: { id?: string }) {
	const id = spaceId(params);
	await current(id);
	return id;
}

export const load = async ({ params }) => {
	const id = spaceId(params);
	const [space, gallery] = await Promise.all([current(id), photos.load(id)]);
	return { space, photos: gallery };
};

export const actions = {
	addPhotos: async (event) => photos.actions.addPhotos(event, await existingId(event.params)),
	editPhoto: async (event) => photos.actions.editPhoto(event, await existingId(event.params)),
	deletePhoto: async (event) => photos.actions.deletePhoto(event, await existingId(event.params)),
	movePhoto: async (event) => photos.actions.movePhoto(event, await existingId(event.params))
};
