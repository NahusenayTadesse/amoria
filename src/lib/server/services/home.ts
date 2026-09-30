import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '$lib/server/db';
import {
	decorPackage,
	eventType,
	packageImage,
	portfolioImage,
	portfolioItem
} from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';

/**
 * Cached public reads for the home page (§10): a few packages, a few portfolio pieces. Every list is small and bounded, tagged `catalog` like the shop's, so a save in
 * the dashboard drops them. Each read fails soft — an empty section is hidden by the page, and a
 * database hiccup never takes the home page down with it.
 */

const TTL = 5 * 60_000;

export type HomePackage = {
	id: number;
	slug: string;
	tier: 'basic' | 'premium' | 'luxury';
	name: string;
	nameAm: string | null;
	summary: string | null;
	summaryAm: string | null;
	inclusions: string[];
	inclusionsAm: string[];
	startingPrice: number;
	eventName: string;
	eventNameAm: string | null;
	image: string | null;
	imageAlt: string | null;
};

export type HomePortfolio = {
	id: number;
	slug: string;
	title: string;
	titleAm: string | null;
	eventName: string | null;
	eventNameAm: string | null;
	image: string;
	imageAlt: string | null;
};

/** `inclusions` is stored as a JSON string array; anything else reads as no list. */
function asList(value: unknown, max: number): string[] {
	return Array.isArray(value)
		? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, max)
		: [];
}

export function homePackages(): Promise<HomePackage[]> {
	return cached('home:packages', { ttlMs: TTL, tags: ['catalog'] }, async () => {
		try {
			const rows = await db
				.select({
					id: decorPackage.id,
					slug: decorPackage.slug,
					tier: decorPackage.tier,
					name: decorPackage.name,
					nameAm: decorPackage.nameAm,
					summary: decorPackage.summary,
					summaryAm: decorPackage.summaryAm,
					inclusions: decorPackage.inclusions,
					inclusionsAm: decorPackage.inclusionsAm,
					startingPrice: decorPackage.startingPrice,
					eventName: eventType.name,
					eventNameAm: eventType.nameAm
				})
				.from(decorPackage)
				.innerJoin(
					eventType,
					and(eq(eventType.id, decorPackage.eventTypeId), notDeleted(eventType))
				)
				.where(and(eq(decorPackage.isActive, true), notDeleted(decorPackage)))
				.orderBy(asc(decorPackage.sortOrder), asc(decorPackage.startingPrice))
				.limit(3);
			if (!rows.length) return [];

			const images = await db
				.select({
					packageId: packageImage.packageId,
					fileName: packageImage.fileName,
					alt: packageImage.alt
				})
				.from(packageImage)
				.where(
					and(
						inArray(
							packageImage.packageId,
							rows.map((row) => row.id)
						),
						notDeleted(packageImage)
					)
				)
				.orderBy(asc(packageImage.packageId), asc(packageImage.sortOrder), asc(packageImage.id));
			const first = new Map<number, { fileName: string; alt: string | null }>();
			for (const image of images)
				if (!first.has(image.packageId)) first.set(image.packageId, image);

			return rows.map((row) => ({
				...row,
				inclusions: asList(row.inclusions, 4),
				inclusionsAm: asList(row.inclusionsAm, 4),
				image: first.get(row.id)?.fileName ?? null,
				imageAlt: first.get(row.id)?.alt ?? null
			}));
		} catch (err) {
			console.error('Home: packages:', err);
			return [];
		}
	});
}

/** Featured pieces that have a photo — a portfolio tile without one has nothing to show. */
export function homePortfolio(): Promise<HomePortfolio[]> {
	return cached('home:portfolio', { ttlMs: TTL, tags: ['catalog'] }, async () => {
		try {
			const rows = await db
				.select({
					id: portfolioItem.id,
					slug: portfolioItem.slug,
					title: portfolioItem.title,
					titleAm: portfolioItem.titleAm,
					eventName: eventType.name,
					eventNameAm: eventType.nameAm
				})
				.from(portfolioItem)
				.leftJoin(
					eventType,
					and(eq(eventType.id, portfolioItem.eventTypeId), notDeleted(eventType))
				)
				.where(
					and(
						eq(portfolioItem.isActive, true),
						eq(portfolioItem.isFeatured, true),
						notDeleted(portfolioItem)
					)
				)
				.orderBy(asc(portfolioItem.sortOrder), desc(portfolioItem.eventDate))
				.limit(6);
			if (!rows.length) return [];

			const images = await db
				.select({
					itemId: portfolioImage.portfolioItemId,
					fileName: portfolioImage.fileName,
					alt: portfolioImage.alt
				})
				.from(portfolioImage)
				.where(
					and(
						inArray(
							portfolioImage.portfolioItemId,
							rows.map((row) => row.id)
						),
						notDeleted(portfolioImage)
					)
				)
				.orderBy(
					asc(portfolioImage.portfolioItemId),
					asc(portfolioImage.sortOrder),
					asc(portfolioImage.id)
				);
			const first = new Map<number, { fileName: string; alt: string | null }>();
			for (const image of images) if (!first.has(image.itemId)) first.set(image.itemId, image);

			return rows.flatMap((row) => {
				const image = first.get(row.id);
				return image ? [{ ...row, image: image.fileName, imageAlt: image.alt }] : [];
			});
		} catch (err) {
			console.error('Home: portfolio:', err);
			return [];
		}
	});
}
