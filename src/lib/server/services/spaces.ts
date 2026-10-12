import { and, asc, eq, inArray } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import { rentalSpace, rentalSpaceImage } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';

/**
 * Cached public reads of the rental spaces (`/spaces`, `/spaces/[slug]`). Tagged `catalog`; the
 * dashboard's space and photo actions call `invalidate('catalog')`.
 */

const TTL = 60_000;

const liveSpace = () => and(eq(rentalSpace.isActive, true), notDeleted(rentalSpace));

const cardColumns = {
	id: rentalSpace.id,
	slug: rentalSpace.slug,
	name: rentalSpace.name,
	nameAm: rentalSpace.nameAm,
	summary: rentalSpace.summary,
	summaryAm: rentalSpace.summaryAm,
	capacity: rentalSpace.capacity,
	sizeText: rentalSpace.sizeText,
	price: rentalSpace.price,
	priceUnit: rentalSpace.priceUnit,
	priceUnitAm: rentalSpace.priceUnitAm,
	youtubeUrl: rentalSpace.youtubeUrl
};

export type SpacePhoto = { id: number; fileName: string; alt: string | null; altAm: string | null };

export type SpaceCard = {
	id: number;
	slug: string;
	name: string;
	nameAm: string | null;
	summary: string | null;
	summaryAm: string | null;
	capacity: number | null;
	sizeText: string | null;
	price: number | null;
	priceUnit: string | null;
	priceUnitAm: string | null;
	youtubeUrl: string | null;
	/** The first photo, for the card. */
	image: SpacePhoto | null;
	photoCount: number;
};

export type SpaceDetail = Omit<SpaceCard, 'image' | 'photoCount'> & {
	description: string | null;
	descriptionAm: string | null;
	features: string[];
	featuresAm: string[];
	images: SpacePhoto[];
};

/** Every live photo of the given spaces, in gallery order, grouped by space. */
async function photosOf(spaceIds: number[]) {
	const bySpace = new Map<number, SpacePhoto[]>();
	if (!spaceIds.length) return bySpace;
	const rows = await db
		.select({
			spaceId: rentalSpaceImage.spaceId,
			id: rentalSpaceImage.id,
			fileName: rentalSpaceImage.fileName,
			alt: rentalSpaceImage.alt,
			altAm: rentalSpaceImage.altAm
		})
		.from(rentalSpaceImage)
		.where(and(inArray(rentalSpaceImage.spaceId, spaceIds), notDeleted(rentalSpaceImage)))
		.orderBy(
			asc(rentalSpaceImage.spaceId),
			asc(rentalSpaceImage.sortOrder),
			asc(rentalSpaceImage.id)
		);
	for (const { spaceId, ...photo } of rows) {
		const list = bySpace.get(spaceId) ?? [];
		list.push(photo);
		bySpace.set(spaceId, list);
	}
	return bySpace;
}

function asList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
		: [];
}

/** Every space on offer, in the dashboard's order, each with its cover photo. */
export function rentalSpaces(): Promise<SpaceCard[]> {
	return cached('spaces:list', { ttlMs: TTL, tags: ['catalog'] }, async () => {
		const rows = await db
			.select(cardColumns)
			.from(rentalSpace)
			.where(liveSpace())
			.orderBy(asc(rentalSpace.sortOrder), asc(rentalSpace.id));
		const photos = await photosOf(rows.map((row) => row.id));
		return rows.map((row) => ({
			...row,
			image: photos.get(row.id)?.[0] ?? null,
			photoCount: photos.get(row.id)?.length ?? 0
		}));
	});
}

/** One space by its link name, with its write-up, features and whole gallery. Null if none. */
export function rentalSpaceBySlug(slug: string): Promise<SpaceDetail | null> {
	return cached(`spaces:one:${slug}`, { ttlMs: TTL, tags: ['catalog'] }, async () => {
		const [row] = await db
			.select({
				...cardColumns,
				description: rentalSpace.description,
				descriptionAm: rentalSpace.descriptionAm,
				features: rentalSpace.features,
				featuresAm: rentalSpace.featuresAm
			})
			.from(rentalSpace)
			.where(and(eq(rentalSpace.slug, slug), liveSpace()));
		if (!row) return null;
		const photos = await photosOf([row.id]);
		return {
			...row,
			features: asList(row.features),
			featuresAm: asList(row.featuresAm),
			images: photos.get(row.id) ?? []
		};
	});
}
