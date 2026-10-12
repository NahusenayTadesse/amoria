import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, inArray, like, ne, or } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import type { Writer } from '@nahu/admin-kit/server/db';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp, notDeleted } from '@nahu/admin-kit/server/softDelete';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { db } from '$lib/server/db';
import {
	account,
	category,
	renter,
	renterBankAccount,
	renterListing,
	renterOrder,
	session,
	user
} from '$lib/server/db/schema';
import { invalidate } from '$lib/server/cache';
import { slugify } from '$lib/slug';
import { OPEN_ORDER, type ListingStatus, type RenterStatus } from '$lib/rentalMarket';
import type { ListingInput } from '$lib/schemas/renters';
import { m } from '$lib/paraglide/messages.js';
import type { Actor } from './payments/payable';

/**
 * Renters and their listings (§5.12): signing up, staff checking them, their shop profile, and
 * the review rule for what they list. Orders are in `renterOrders.ts`, guest reads in
 * `marketplace.ts`.
 *
 * Every write that changes what guests see drops the `marketplace` cache and the public-image list.
 */

export type RenterRow = typeof renter.$inferSelect;

function refresh() {
	invalidate('marketplace');
	invalidate('public-images');
}

/** Who is acting, for the audit trail. */
function actorId(actor: Actor): string {
	const id = actor.locals.user?.id;
	if (!id) throw new WriteRefused(null, 'Sign in again: your session has ended.');
	return id;
}

/** A link name no other renter has: `addis-sound`, then `addis-sound-2`… */
async function freeSlug(tx: Writer, base: string): Promise<string> {
	const stem = slugify(base) || 'renter';
	const taken = await tx
		.select({ slug: renter.slug })
		.from(renter)
		.where(or(eq(renter.slug, stem), like(renter.slug, `${stem}-%`)));
	const used = new Set(taken.map((row) => row.slug));
	if (!used.has(stem)) return stem;
	for (let n = 2; ; n++) if (!used.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

/** The same for a listing. */
async function freeListingSlug(tx: Writer, base: string, except?: number): Promise<string> {
	const stem = slugify(base) || 'rental';
	const taken = await tx
		.select({ slug: renterListing.slug })
		.from(renterListing)
		.where(
			and(
				or(eq(renterListing.slug, stem), like(renterListing.slug, `${stem}-%`)),
				except ? ne(renterListing.id, except) : undefined
			)
		);
	const used = new Set(taken.map((row) => row.slug));
	if (!used.has(stem)) return stem;
	for (let n = 2; ; n++) if (!used.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

// ------------------------------------------------------------------ signing up

export type RenterSignup = {
	ownerName: string;
	email: string;
	password: string;
	businessName: string;
	phone: string;
	area: string;
	tinNumber: string;
	/** Already saved to the private store. */
	tradeLicenceFile: string;
	locale: 'en' | 'am';
};

/**
 * A business asks to rent out on Amoria: a `renter` account (better-auth's user + credential rows,
 * written here as staff accounts are, so nothing signs anyone in as somebody else) and its renter
 * row, `pending` until staff check the papers. The route signs them in afterwards.
 */
export async function registerRenter(
	input: RenterSignup
): Promise<{ userId: string; slug: string }> {
	const email = input.email.trim().toLowerCase();
	const hash = await hashPassword(input.password);

	return db.transaction(async (tx) => {
		const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
		if (taken) throw new WriteRefused('email', m.join_email_taken());

		const userId = randomBytes(16).toString('hex');
		await tx.insert(user).values({
			id: userId,
			name: input.ownerName,
			email,
			emailVerified: false,
			role: 'renter',
			phone: normalizePhone(input.phone) ?? input.phone,
			locale: input.locale
		});
		await tx.insert(account).values({
			id: randomBytes(16).toString('hex'),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: hash
		});
		const slug = await freeSlug(tx, input.businessName);
		await tx.insert(renter).values({
			userId,
			slug,
			businessName: input.businessName,
			phone: normalizePhone(input.phone) ?? input.phone,
			area: input.area || null,
			tinNumber: input.tinNumber,
			tradeLicenceFile: input.tradeLicenceFile
		});
		return { userId, slug };
	});
}

/** The renter behind a signed-in account, or null. */
export async function renterForUser(userId: string): Promise<RenterRow | null> {
	const [row] = await db.select().from(renter).where(eq(renter.userId, userId));
	return row ?? null;
}

// ------------------------------------------------------------------ staff review

export type RenterDecision = 'approve' | 'reject' | 'suspend' | 'reinstate';

const DECISION_FROM: Record<RenterDecision, RenterStatus[]> = {
	approve: ['pending', 'rejected'],
	reject: ['pending'],
	suspend: ['approved'],
	reinstate: ['suspended']
};

const DECISION_TO: Record<RenterDecision, RenterStatus> = {
	approve: 'approved',
	reject: 'rejected',
	suspend: 'suspended',
	reinstate: 'approved'
};

/**
 * Staff decide on a renter. Approving needs the papers looked at; turning down and suspending need
 * a reason the renter reads. A suspended renter's listings and page leave the site at once (the
 * public reads check the renter's status), and their sessions end, so a suspension bites now.
 */
export async function reviewRenter(
	actor: Actor,
	renterId: number,
	decision: RenterDecision,
	note: string | null
) {
	const by = actorId(actor);
	if ((decision === 'reject' || decision === 'suspend') && !note) {
		throw new WriteRefused('note', 'Say why, for the renter.');
	}
	await db.transaction(async (tx) => {
		const [row] = await tx.select().from(renter).where(eq(renter.id, renterId)).for('update');
		if (!row) throw new WriteRefused(null, 'That renter does not exist.');
		if (!DECISION_FROM[decision].includes(row.status)) {
			throw new WriteRefused(null, `A renter who is ${row.status} cannot be given that decision.`);
		}
		const now = new Date();
		const to = DECISION_TO[decision];
		const values = {
			status: to,
			reviewNote: decision === 'approve' || decision === 'reinstate' ? null : note,
			reviewedBy: by,
			reviewedAt: now,
			approvedAt: to === 'approved' ? (row.approvedAt ?? now) : row.approvedAt
		};
		await tx.update(renter).set(values).where(eq(renter.id, renterId));
		if (decision === 'suspend') await tx.delete(session).where(eq(session.userId, row.userId));
		await recordAudit(tx, actor, {
			table: 'renter',
			recordId: renterId,
			action: 'update',
			before: { status: row.status, reviewNote: row.reviewNote },
			after: { status: to, reviewNote: values.reviewNote }
		});
	});
	refresh();
}

/** Staff trust a renter (listings go live without review) or feature them on the marketplace. */
export async function setRenterFlags(
	actor: Actor,
	renterId: number,
	flags: { autoPublish?: boolean; isFeatured?: boolean }
) {
	actorId(actor);
	await db.transaction(async (tx) => {
		const [row] = await tx.select().from(renter).where(eq(renter.id, renterId)).for('update');
		if (!row) throw new WriteRefused(null, 'That renter does not exist.');
		await tx.update(renter).set(flags).where(eq(renter.id, renterId));
		await recordAudit(tx, actor, {
			table: 'renter',
			recordId: renterId,
			action: 'update',
			before: { autoPublish: row.autoPublish, isFeatured: row.isFeatured },
			after: flags
		});
	});
	refresh();
}

/** Staff approve a listing (it goes live) or send it back with what to fix. */
export async function reviewListing(
	actor: Actor,
	listingId: number,
	decision: 'approve' | 'reject',
	note: string | null
) {
	const by = actorId(actor);
	if (decision === 'reject' && !note) throw new WriteRefused('note', 'Say what to fix.');
	await db.transaction(async (tx) => {
		const [row] = await tx
			.select({
				status: renterListing.status,
				publishedAt: renterListing.publishedAt,
				renterStatus: renter.status
			})
			.from(renterListing)
			.innerJoin(renter, eq(renter.id, renterListing.renterId))
			.where(and(eq(renterListing.id, listingId), notDeleted(renterListing)))
			.for('update');
		if (!row) throw new WriteRefused(null, 'That listing does not exist.');
		if (decision === 'approve' && row.renterStatus !== 'approved') {
			throw new WriteRefused(
				null,
				'Approve the renter first: their listings cannot go live before.'
			);
		}
		if (!['pending_review', 'rejected', 'approved', 'paused'].includes(row.status)) {
			throw new WriteRefused(null, 'This listing is not waiting for a review.');
		}
		const now = new Date();
		const to: ListingStatus = decision === 'approve' ? 'approved' : 'rejected';
		await tx
			.update(renterListing)
			.set({
				status: to,
				reviewNote: decision === 'approve' ? null : note,
				reviewedBy: by,
				reviewedAt: now,
				publishedAt: to === 'approved' ? (row.publishedAt ?? now) : row.publishedAt
			})
			.where(eq(renterListing.id, listingId));
		await recordAudit(tx, actor, {
			table: 'renter_listing',
			recordId: listingId,
			action: 'update',
			before: { status: row.status },
			after: { status: to, reviewNote: decision === 'approve' ? null : note }
		});
	});
	refresh();
}

// ------------------------------------------------------------------ the renter's own

export type ProfileInput = {
	businessName: string;
	businessNameAm: string;
	tagline: string;
	taglineAm: string;
	about: string;
	aboutAm: string;
	policies: string;
	policiesAm: string;
	area: string;
	serviceAreas: string;
	foundedYear?: number;
	offersDelivery: boolean;
	offersSetup: boolean;
	phone: string;
	whatsapp: string;
	telegram: string;
};

/**
 * The renter edits their page. Logo and cover are already saved (or left as they were). The link
 * name stays: it is printed on their cards and shared.
 */
export async function updateProfile(
	actor: Actor,
	renterId: number,
	input: ProfileInput,
	files: { logoFile?: string | null; coverFile?: string | null }
) {
	const blank = (v: string) => v.trim() || null;
	const values = {
		businessName: input.businessName,
		businessNameAm: blank(input.businessNameAm),
		tagline: blank(input.tagline),
		taglineAm: blank(input.taglineAm),
		about: blank(input.about),
		aboutAm: blank(input.aboutAm),
		policies: blank(input.policies),
		policiesAm: blank(input.policiesAm),
		area: blank(input.area),
		serviceAreas: blank(input.serviceAreas),
		foundedYear: input.foundedYear ?? null,
		offersDelivery: input.offersDelivery,
		offersSetup: input.offersSetup,
		phone: normalizePhone(input.phone) ?? input.phone,
		whatsapp: input.whatsapp ? (normalizePhone(input.whatsapp) ?? input.whatsapp) : null,
		telegram: input.telegram ? input.telegram.replace(/^@/, '') : null,
		...(files.logoFile !== undefined ? { logoFile: files.logoFile } : {}),
		...(files.coverFile !== undefined ? { coverFile: files.coverFile } : {})
	};
	await db.transaction(async (tx) => {
		const [before] = await tx.select().from(renter).where(eq(renter.id, renterId)).for('update');
		if (!before) throw new WriteRefused(null, 'Your renter account was not found.');
		await tx.update(renter).set(values).where(eq(renter.id, renterId));
		await recordAudit(tx, actor, {
			table: 'renter',
			recordId: renterId,
			action: 'update',
			before,
			after: values
		});
	});
	refresh();
}

/** A turned-down renter sends their papers again and goes back in the queue. */
export async function resubmitDocuments(
	actor: Actor,
	renterId: number,
	input: { tinNumber: string; tradeLicenceFile: string }
) {
	await db.transaction(async (tx) => {
		const [row] = await tx.select().from(renter).where(eq(renter.id, renterId)).for('update');
		if (!row) throw new WriteRefused(null, 'Your renter account was not found.');
		if (row.status !== 'rejected' && row.status !== 'pending') {
			throw new WriteRefused(
				null,
				'Your papers are already approved. Contact Amoria to change them.'
			);
		}
		await tx
			.update(renter)
			.set({ ...input, status: 'pending' })
			.where(eq(renter.id, renterId));
		await recordAudit(tx, actor, {
			table: 'renter',
			recordId: renterId,
			action: 'update',
			before: { status: row.status, tinNumber: row.tinNumber },
			after: { status: 'pending', tinNumber: input.tinNumber }
		});
	});
}

// ------------------------------------------------------------------ listings

/** The rental categories a listing can be filed under (Amoria's, kind `rental`). */
export function rentalCategories() {
	return db
		.select({ id: category.id, name: category.name })
		.from(category)
		.where(and(eq(category.kind, 'rental'), eq(category.status, true), notDeleted(category)))
		.orderBy(asc(category.sortOrder), asc(category.name));
}

/**
 * Where a listing goes after the renter changed it (§5.12 "review"): a trusted renter's goes (or
 * stays) live; anyone else's waits for staff. A paused listing stays paused, but a change still
 * needs review before it can come back.
 */
export function afterChange(
	current: ListingStatus | null,
	trusted: boolean
): { status: ListingStatus; needsReview: boolean } {
	if (trusted) return { status: current === 'paused' ? 'paused' : 'approved', needsReview: false };
	return { status: 'pending_review', needsReview: true };
}

function listingValues(input: ListingInput) {
	const blank = (v: string) => v.trim() || null;
	const list = (v: string) =>
		v
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
	return {
		categoryId: input.categoryId,
		name: input.name,
		nameAm: blank(input.nameAm),
		summary: blank(input.summary),
		summaryAm: blank(input.summaryAm),
		description: blank(input.description),
		descriptionAm: blank(input.descriptionAm),
		features: list(input.features),
		featuresAm: list(input.featuresAm),
		pricing: input.pricing,
		price: input.price ?? null,
		priceUnit: input.priceUnit,
		deposit: input.deposit,
		quantity: input.quantity,
		capacity: input.capacity ?? null,
		youtubeUrl: blank(input.youtubeUrl),
		deliveryAvailable: input.deliveryAvailable,
		setupIncluded: input.setupIncluded
	};
}

/** The renter, locked, refusing anyone who may not list yet. */
async function listingRenter(tx: Writer, renterId: number) {
	const [row] = await tx
		.select({ status: renter.status, autoPublish: renter.autoPublish })
		.from(renter)
		.where(eq(renter.id, renterId))
		.for('update');
	if (!row) throw new WriteRefused(null, 'Your renter account was not found.');
	if (row.status !== 'approved') {
		throw new WriteRefused(
			null,
			row.status === 'suspended'
				? 'Your account is suspended, so you cannot change listings. Contact Amoria.'
				: 'You can list rentals once Amoria has approved your business.'
		);
	}
	return row;
}

async function checkCategory(tx: Writer, categoryId: number) {
	const [row] = await tx
		.select({ id: category.id })
		.from(category)
		.where(
			and(
				eq(category.id, categoryId),
				eq(category.kind, 'rental'),
				eq(category.status, true),
				notDeleted(category)
			)
		);
	if (!row) throw new WriteRefused('categoryId', 'Choose one of the rental categories.');
}

/** A new listing. Live at once for a trusted renter, otherwise in the review queue. */
export async function createListing(actor: Actor, renterId: number, input: ListingInput) {
	const id = await db.transaction(async (tx) => {
		const owner = await listingRenter(tx, renterId);
		await checkCategory(tx, input.categoryId);
		const { status } = afterChange(null, owner.autoPublish);
		const id = await insertReturningId(tx, renterListing, {
			renterId,
			slug: await freeListingSlug(tx, input.name),
			...listingValues(input),
			status,
			publishedAt: status === 'approved' ? new Date() : null
		});
		await recordAudit(tx, actor, {
			table: 'renter_listing',
			recordId: id,
			action: 'create',
			detail: { status }
		});
		return id;
	});
	refresh();
	return id;
}

/** The renter's own listing, locked; refuses one that is not theirs. */
async function ownListing(tx: Writer, renterId: number, listingId: number) {
	const [row] = await tx
		.select()
		.from(renterListing)
		.where(
			and(
				eq(renterListing.id, listingId),
				eq(renterListing.renterId, renterId),
				notDeleted(renterListing)
			)
		)
		.for('update');
	if (!row) throw new WriteRefused(null, 'That listing was not found.');
	return row;
}

/** The renter changes a listing; it goes back for review unless they are trusted. */
export async function updateListing(
	actor: Actor,
	renterId: number,
	listingId: number,
	input: ListingInput
): Promise<{ status: ListingStatus }> {
	const result = await db.transaction(async (tx) => {
		const owner = await listingRenter(tx, renterId);
		const before = await ownListing(tx, renterId, listingId);
		await checkCategory(tx, input.categoryId);
		const values = listingValues(input);
		const { status } = afterChange(before.status, owner.autoPublish);
		await tx
			.update(renterListing)
			.set({
				...values,
				status,
				reviewNote: status === 'pending_review' ? null : before.reviewNote,
				publishedAt: status === 'approved' ? (before.publishedAt ?? new Date()) : before.publishedAt
			})
			.where(eq(renterListing.id, listingId));
		await recordAudit(tx, actor, {
			table: 'renter_listing',
			recordId: listingId,
			action: 'update',
			before: { ...before, status: before.status },
			after: { ...values, status }
		});
		return { status };
	});
	refresh();
	return result;
}

/**
 * Photos changed on a listing: for a renter who is not trusted, a live listing goes back for
 * review, since a new photo is new content. Removing or reordering photos does not call this.
 */
export async function photosChanged(renterId: number, listingId: number) {
	await db.transaction(async (tx) => {
		const [owner] = await tx
			.select({ autoPublish: renter.autoPublish, status: renter.status })
			.from(renter)
			.where(eq(renter.id, renterId));
		const row = await ownListing(tx, renterId, listingId);
		const trusted = owner?.status === 'approved' && owner.autoPublish;
		if (trusted || row.status === 'pending_review' || row.status === 'draft') return;
		await tx
			.update(renterListing)
			.set({ status: 'pending_review', reviewNote: null })
			.where(eq(renterListing.id, listingId));
	});
	refresh();
}

/**
 * The renter takes a live listing off the site for a while, or puts it back. A listing that was
 * changed while paused (`pending_review`) comes back only through review.
 */
export async function setListingPaused(
	actor: Actor,
	renterId: number,
	listingId: number,
	paused: boolean
) {
	await db.transaction(async (tx) => {
		await listingRenter(tx, renterId);
		const row = await ownListing(tx, renterId, listingId);
		const from: ListingStatus = paused ? 'approved' : 'paused';
		if (row.status !== from) {
			throw new WriteRefused(
				null,
				paused
					? 'Only a live listing can be paused.'
					: 'Only a paused listing can be put back on the site.'
			);
		}
		const to: ListingStatus = paused ? 'paused' : 'approved';
		await tx.update(renterListing).set({ status: to }).where(eq(renterListing.id, listingId));
		await recordAudit(tx, actor, {
			table: 'renter_listing',
			recordId: listingId,
			action: 'update',
			before: { status: row.status },
			after: { status: to }
		});
	});
	refresh();
}

/** A renter removes a listing for good. Refused while customers still have open orders on it. */
export async function deleteListing(actor: Actor, renterId: number, listingId: number) {
	const by = actorId(actor);
	await db.transaction(async (tx) => {
		await ownListing(tx, renterId, listingId);
		const [{ open }] = await tx
			.select({ open: count() })
			.from(renterOrder)
			.where(and(eq(renterOrder.listingId, listingId), inArray(renterOrder.status, OPEN_ORDER)));
		if (open) {
			throw new WriteRefused(
				null,
				`${open} open order${open === 1 ? '' : 's'} still need this listing. Finish or cancel them first, or pause it.`
			);
		}
		await tx.update(renterListing).set(deletionStamp(by)).where(eq(renterListing.id, listingId));
		await recordAudit(tx, actor, {
			table: 'renter_listing',
			recordId: listingId,
			action: 'delete'
		});
	});
	refresh();
}

/** The renter's live bank accounts, where their customers transfer to. */
export function renterAccounts(renterId: number) {
	return db
		.select({
			id: renterBankAccount.id,
			bankName: renterBankAccount.bankName,
			accountName: renterBankAccount.accountName,
			accountNumber: renterBankAccount.accountNumber
		})
		.from(renterBankAccount)
		.where(
			and(
				eq(renterBankAccount.renterId, renterId),
				eq(renterBankAccount.status, true),
				notDeleted(renterBankAccount)
			)
		)
		.orderBy(asc(renterBankAccount.sortOrder), asc(renterBankAccount.id));
}
