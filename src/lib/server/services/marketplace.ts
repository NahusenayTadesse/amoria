import { and, asc, count, desc, eq, inArray, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import {
	category,
	renter,
	renterListing,
	renterListingImage,
	renterOrder
} from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';
import type { PriceUnit } from '$lib/rentalMarket';

/**
 * What guests see of the rental marketplace (§5.12): listings that are `approved`, from renters
 * that are `approved`. Lists are cached under the `marketplace` tag, which every renter and review
 * write drops; the filtered listing search is not cached (too many shapes) but is one bounded
 * query of 24 rows plus their cover photos.
 */

const TTL = 60_000;
export const PAGE_SIZE = 24;

/** Shown to guests: the listing and its renter both approved. */
const liveListing = () =>
	and(eq(renterListing.status, 'approved'), notDeleted(renterListing)) as SQL;
const liveRenter = () => eq(renter.status, 'approved');

export type Photo = { id: number; fileName: string; alt: string | null; altAm: string | null };

export type ListingCard = {
	id: number;
	slug: string;
	name: string;
	nameAm: string | null;
	summary: string | null;
	summaryAm: string | null;
	pricing: 'fixed' | 'quote';
	price: number | null;
	priceUnit: PriceUnit;
	capacity: number | null;
	deliveryAvailable: boolean;
	setupIncluded: boolean;
	publishedAt: Date | null;
	categoryName: string;
	categoryNameAm: string | null;
	renterSlug: string;
	renterName: string;
	renterNameAm: string | null;
	renterLogo: string | null;
	image: Photo | null;
	photoCount: number;
};

const cardColumns = {
	id: renterListing.id,
	slug: renterListing.slug,
	name: renterListing.name,
	nameAm: renterListing.nameAm,
	summary: renterListing.summary,
	summaryAm: renterListing.summaryAm,
	pricing: renterListing.pricing,
	price: renterListing.price,
	priceUnit: renterListing.priceUnit,
	capacity: renterListing.capacity,
	deliveryAvailable: renterListing.deliveryAvailable,
	setupIncluded: renterListing.setupIncluded,
	publishedAt: renterListing.publishedAt,
	categoryName: category.name,
	categoryNameAm: category.nameAm,
	renterSlug: renter.slug,
	renterName: renter.businessName,
	renterNameAm: renter.businessNameAm,
	renterLogo: renter.logoFile
};

/** Every live photo of the given listings, in gallery order, grouped by listing. */
async function photosOf(listingIds: number[]) {
	const byListing = new Map<number, Photo[]>();
	if (!listingIds.length) return byListing;
	const rows = await db
		.select({
			listingId: renterListingImage.listingId,
			id: renterListingImage.id,
			fileName: renterListingImage.fileName,
			alt: renterListingImage.alt,
			altAm: renterListingImage.altAm
		})
		.from(renterListingImage)
		.where(and(inArray(renterListingImage.listingId, listingIds), notDeleted(renterListingImage)))
		.orderBy(
			asc(renterListingImage.listingId),
			asc(renterListingImage.sortOrder),
			asc(renterListingImage.id)
		);
	for (const { listingId, ...photo } of rows) {
		const list = byListing.get(listingId) ?? [];
		list.push(photo);
		byListing.set(listingId, list);
	}
	return byListing;
}

async function withPhotos<T extends { id: number }>(rows: T[]) {
	const photos = await photosOf(rows.map((row) => row.id));
	return rows.map((row) => ({
		...row,
		image: photos.get(row.id)?.[0] ?? null,
		photoCount: photos.get(row.id)?.length ?? 0
	}));
}

function asList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
		: [];
}

// ------------------------------------------------------------------ the marketplace

export const SORTS = ['featured', 'new', 'price_asc', 'price_desc'] as const;
export type MarketSort = (typeof SORTS)[number];

export type MarketFilters = {
	category?: string;
	renter?: string;
	pricing?: 'fixed' | 'quote';
	delivery?: boolean;
	q?: string;
	sort: MarketSort;
	page: number;
};

/** One page of live listings, filtered, with the total for the pager. */
export async function searchListings(filters: MarketFilters) {
	const term = filters.q?.trim().slice(0, 60);
	const where = and(
		liveListing(),
		liveRenter(),
		filters.category ? eq(category.slug, filters.category) : undefined,
		filters.renter ? eq(renter.slug, filters.renter) : undefined,
		filters.pricing ? eq(renterListing.pricing, filters.pricing) : undefined,
		filters.delivery ? eq(renterListing.deliveryAvailable, true) : undefined,
		term
			? or(
					like(renterListing.name, `%${term}%`),
					like(renterListing.nameAm, `%${term}%`),
					like(renterListing.summary, `%${term}%`),
					like(renter.businessName, `%${term}%`)
				)
			: undefined
	);
	const order: SQL[] =
		filters.sort === 'new'
			? [desc(renterListing.publishedAt)]
			: filters.sort === 'price_asc'
				? [sql`${renterListing.price} IS NULL`, asc(renterListing.price)]
				: filters.sort === 'price_desc'
					? [sql`${renterListing.price} IS NULL`, desc(renterListing.price)]
					: [
							desc(renter.isFeatured),
							asc(renterListing.sortOrder),
							desc(renterListing.publishedAt)
						];

	const from = () =>
		db
			.select(cardColumns)
			.from(renterListing)
			.innerJoin(renter, eq(renter.id, renterListing.renterId))
			.innerJoin(category, eq(category.id, renterListing.categoryId));

	const [rows, [{ total }]] = await Promise.all([
		from()
			.where(where)
			.orderBy(...order, asc(renterListing.id))
			.limit(PAGE_SIZE)
			.offset((Math.max(1, filters.page) - 1) * PAGE_SIZE),
		db
			.select({ total: count() })
			.from(renterListing)
			.innerJoin(renter, eq(renter.id, renterListing.renterId))
			.innerJoin(category, eq(category.id, renterListing.categoryId))
			.where(where)
	]);
	return { listings: (await withPhotos(rows)) as ListingCard[], total };
}

/**
 * Rentals to show off on the home page: featured renters' first, then the newest, a few per
 * renter at most so one big catalogue does not fill the row.
 */
export function showcaseListings(limit = 8): Promise<ListingCard[]> {
	return cached(
		`market:showcase:${limit}`,
		{ ttlMs: TTL, tags: ['marketplace', 'catalog'] },
		async () => {
			const rows = await db
				.select(cardColumns)
				.from(renterListing)
				.innerJoin(renter, eq(renter.id, renterListing.renterId))
				.innerJoin(category, eq(category.id, renterListing.categoryId))
				.where(and(liveListing(), liveRenter()))
				.orderBy(desc(renter.isFeatured), desc(renterListing.publishedAt))
				.limit(limit * 4);
			const perRenter = new Map<string, number>();
			const picked = rows.filter((row) => {
				const n = perRenter.get(row.renterSlug) ?? 0;
				perRenter.set(row.renterSlug, n + 1);
				return n < 2;
			});
			return (await withPhotos(picked.slice(0, limit))) as ListingCard[];
		}
	);
}

/** The categories and renters that have something live, with how many, for the filters. */
export function marketFacets() {
	return cached('market:facets', { ttlMs: TTL, tags: ['marketplace', 'catalog'] }, async () => {
		const [categories, renters] = await Promise.all([
			db
				.select({
					slug: category.slug,
					name: category.name,
					nameAm: category.nameAm,
					count: count()
				})
				.from(renterListing)
				.innerJoin(renter, eq(renter.id, renterListing.renterId))
				.innerJoin(category, eq(category.id, renterListing.categoryId))
				.where(and(liveListing(), liveRenter()))
				.groupBy(category.id, category.slug, category.name, category.nameAm, category.sortOrder)
				.orderBy(asc(category.sortOrder), asc(category.name)),
			db
				.select({
					slug: renter.slug,
					name: renter.businessName,
					nameAm: renter.businessNameAm,
					count: count()
				})
				.from(renterListing)
				.innerJoin(renter, eq(renter.id, renterListing.renterId))
				.where(and(liveListing(), liveRenter()))
				.groupBy(renter.id, renter.slug, renter.businessName, renter.businessNameAm)
				.orderBy(asc(renter.businessName))
		]);
		return { categories, renters };
	});
}

// ------------------------------------------------------------------ one listing

export type ListingDetail = Awaited<ReturnType<typeof loadListing>>;

async function loadListing(slug: string) {
	const [row] = await db
		.select({
			...cardColumns,
			description: renterListing.description,
			descriptionAm: renterListing.descriptionAm,
			features: renterListing.features,
			featuresAm: renterListing.featuresAm,
			deposit: renterListing.deposit,
			quantity: renterListing.quantity,
			youtubeUrl: renterListing.youtubeUrl,
			categorySlug: category.slug,
			renterId: renter.id
		})
		.from(renterListing)
		.innerJoin(renter, eq(renter.id, renterListing.renterId))
		.innerJoin(category, eq(category.id, renterListing.categoryId))
		.where(and(eq(renterListing.slug, slug), liveListing(), liveRenter()));
	if (!row) return null;

	const [photos, more] = await Promise.all([
		photosOf([row.id]),
		db
			.select(cardColumns)
			.from(renterListing)
			.innerJoin(renter, eq(renter.id, renterListing.renterId))
			.innerJoin(category, eq(category.id, renterListing.categoryId))
			.where(
				and(eq(renterListing.renterId, row.renterId), ne(renterListing.id, row.id), liveListing())
			)
			.orderBy(asc(renterListing.sortOrder), desc(renterListing.publishedAt))
			.limit(3)
	]);
	const { renterId, ...listing } = row;
	return {
		listing: {
			...listing,
			features: asList(row.features),
			featuresAm: asList(row.featuresAm),
			images: photos.get(row.id) ?? []
		},
		renter: await renterCard(renterId),
		more: (await withPhotos(more)) as ListingCard[]
	};
}

/** One live listing by its link name, with its renter and three more of theirs. Null if none. */
export function listingBySlug(slug: string) {
	return cached(`market:listing:${slug}`, { ttlMs: TTL, tags: ['marketplace'] }, () =>
		loadListing(slug)
	);
}

// ------------------------------------------------------------------ renters

export type RenterCard = {
	id: number;
	slug: string;
	businessName: string;
	businessNameAm: string | null;
	tagline: string | null;
	taglineAm: string | null;
	logoFile: string | null;
	coverFile: string | null;
	area: string | null;
	serviceAreas: string | null;
	foundedYear: number | null;
	offersDelivery: boolean;
	offersSetup: boolean;
	isFeatured: boolean;
	approvedAt: Date | null;
	/** Live listings. */
	listingCount: number;
	/** Orders they have seen through: a plain measure of track record. */
	completedCount: number;
	/** Slugs of the categories they have live listings in. */
	categories: string[];
};

const renterColumns = {
	id: renter.id,
	slug: renter.slug,
	businessName: renter.businessName,
	businessNameAm: renter.businessNameAm,
	tagline: renter.tagline,
	taglineAm: renter.taglineAm,
	logoFile: renter.logoFile,
	coverFile: renter.coverFile,
	area: renter.area,
	serviceAreas: renter.serviceAreas,
	foundedYear: renter.foundedYear,
	offersDelivery: renter.offersDelivery,
	offersSetup: renter.offersSetup,
	isFeatured: renter.isFeatured,
	approvedAt: renter.approvedAt
};

/** Every approved renter with their numbers and categories, for the directory. */
export function renterDirectory(): Promise<RenterCard[]> {
	return cached('market:renters', { ttlMs: TTL, tags: ['marketplace', 'catalog'] }, async () => {
		const rows = await db
			.select(renterColumns)
			.from(renter)
			.where(liveRenter())
			.orderBy(desc(renter.isFeatured), asc(renter.businessName));
		return withStats(rows);
	});
}

async function withStats<T extends { id: number }>(rows: T[]): Promise<(T & RenterStats)[]> {
	const ids = rows.map((row) => row.id);
	if (!ids.length) return [];
	const [listings, completed] = await Promise.all([
		db
			.select({ renterId: renterListing.renterId, slug: category.slug, n: count() })
			.from(renterListing)
			.innerJoin(category, eq(category.id, renterListing.categoryId))
			.where(and(inArray(renterListing.renterId, ids), liveListing()))
			.groupBy(renterListing.renterId, category.slug),
		db
			.select({ renterId: renterOrder.renterId, n: count() })
			.from(renterOrder)
			.where(and(inArray(renterOrder.renterId, ids), eq(renterOrder.status, 'completed')))
			.groupBy(renterOrder.renterId)
	]);
	return rows.map((row) => {
		const mine = listings.filter((l) => l.renterId === row.id);
		return {
			...row,
			listingCount: mine.reduce((total, l) => total + Number(l.n), 0),
			completedCount: Number(completed.find((c) => c.renterId === row.id)?.n ?? 0),
			categories: mine.map((l) => l.slug)
		};
	});
}

type RenterStats = { listingCount: number; completedCount: number; categories: string[] };

async function renterCard(id: number): Promise<
	RenterCard & {
		phone: string;
		whatsapp: string | null;
		telegram: string | null;
		policies: string | null;
		policiesAm: string | null;
	}
> {
	const [row] = await db
		.select({
			...renterColumns,
			phone: renter.phone,
			whatsapp: renter.whatsapp,
			telegram: renter.telegram,
			policies: renter.policies,
			policiesAm: renter.policiesAm
		})
		.from(renter)
		.where(eq(renter.id, id));
	const [card] = await withStats([row]);
	return card;
}

/** A renter's page: their profile, numbers and every live listing. Null if not approved. */
export function renterBySlug(slug: string) {
	return cached(`market:renter:${slug}`, { ttlMs: TTL, tags: ['marketplace'] }, async () => {
		const [row] = await db
			.select({ id: renter.id, about: renter.about, aboutAm: renter.aboutAm })
			.from(renter)
			.where(and(eq(renter.slug, slug), liveRenter()));
		if (!row) return null;
		const [card, listings] = await Promise.all([
			renterCard(row.id),
			db
				.select({ ...cardColumns, categorySlug: category.slug })
				.from(renterListing)
				.innerJoin(renter, eq(renter.id, renterListing.renterId))
				.innerJoin(category, eq(category.id, renterListing.categoryId))
				.where(and(eq(renterListing.renterId, row.id), liveListing()))
				.orderBy(asc(renterListing.sortOrder), desc(renterListing.publishedAt))
		]);
		return {
			renter: { ...card, about: row.about, aboutAm: row.aboutAm },
			listings: (await withPhotos(listings)) as (ListingCard & { categorySlug: string })[]
		};
	});
}
