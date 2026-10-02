/**
 * Expiry follow-up: expired and soon-to-expire lots by location, and the two things to do about
 * them — move them into quarantine (off sale, not yet written off) or write them off.
 *
 * Whether a lot is expired is read off its date against today, never stored (`stock_lot`). Both
 * actions only *draft* a document; a person checks it and posts it, like any other.
 */
import { and, asc, eq, gt, lte, ne, or, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { addLocalDays, localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { location, product, stockBalance, stockLot } from '$lib/server/db/schema';
import type { LOT_STATUSES } from '$lib/constants';
import type { Actor } from '../payments/payable';
import { getSettings } from '../settings';
import { saveDocument } from './documents';

export type ExpiryRow = {
	lotId: number;
	productId: number;
	product: string;
	sku: string | null;
	lotNumber: string;
	expiryDate: string;
	locationId: number;
	location: string;
	locationKind: 'shop' | 'storage' | 'workshop' | 'quarantine';
	quantity: number;
	lotStatus: (typeof LOT_STATUSES)[number];
	daysLeft: number;
	/** `expired` past the date; `expiring` within the warning window; `flagged` pulled or recalled. */
	state: 'expired' | 'expiring' | 'flagged';
};

/** Days from `today` to `day` (negative once past). */
function daysUntil(day: string, today: string) {
	return Math.round(
		(Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
	);
}

/**
 * Lots with stock that are expired, expiring within the warning window (`settings.expiryWarningDays`
 * unless given), or flagged (quarantined or recalled by a person). Soonest first.
 */
export async function expiryReport(
	options: { locationId?: number | null; today?: string; warningDays?: number } = {}
): Promise<ExpiryRow[]> {
	const today = options.today ?? localToday();
	const warningDays = options.warningDays ?? (await getSettings()).expiryWarningDays;
	const horizon = addLocalDays(today, warningDays);

	const rows = await db
		.select({
			lotId: stockLot.id,
			productId: product.id,
			product: product.name,
			sku: product.sku,
			lotNumber: stockLot.lotNumber,
			expiryDate: stockLot.expiryDate,
			locationId: location.id,
			location: location.name,
			locationKind: location.kind,
			quantity: stockBalance.quantity,
			lotStatus: stockLot.status
		})
		.from(stockBalance)
		.innerJoin(stockLot, eq(stockLot.id, stockBalance.lotId))
		.innerJoin(product, eq(product.id, stockBalance.productId))
		.innerJoin(location, eq(location.id, stockBalance.locationId))
		.where(
			and(
				gt(stockBalance.quantity, 0),
				sql`${product.deletedAt} IS NULL`,
				options.locationId ? eq(stockBalance.locationId, options.locationId) : undefined,
				or(lte(stockLot.expiryDate, horizon), ne(stockLot.status, 'available'))
			)
		)
		.orderBy(sql`${stockLot.expiryDate} IS NULL`, asc(stockLot.expiryDate), asc(product.name));

	return rows.map((r) => {
		const daysLeft = r.expiryDate ? daysUntil(r.expiryDate, today) : Number.POSITIVE_INFINITY;
		return {
			...r,
			expiryDate: r.expiryDate ?? '',
			daysLeft,
			state:
				r.expiryDate && r.expiryDate < today
					? 'expired'
					: daysLeft <= warningDays
						? 'expiring'
						: 'flagged'
		};
	});
}

/** The expired lots at one location that are not already in quarantine. */
async function expiredAt(locationId: number, today: string) {
	const loc = await db
		.select({ kind: location.kind })
		.from(location)
		.where(eq(location.id, locationId));
	if (!loc[0]) throw new WriteRefused(null, 'That location does not exist.');
	if (loc[0].kind === 'quarantine') {
		throw new WriteRefused(
			null,
			'That location is already quarantine. Write the stock off instead.'
		);
	}
	const rows = await expiryReport({ locationId, today, warningDays: 0 });
	const expired = rows.filter((r) => r.state === 'expired');
	if (!expired.length) throw new WriteRefused(null, 'Nothing there has expired.');
	return expired;
}

/**
 * Drafts a transfer of everything expired at a location into a quarantine location (made on first
 * use), so it comes off the shelf without being written off yet. Returns the draft's id.
 */
export async function draftQuarantine(locationId: number, actor: Actor): Promise<number> {
	const today = localToday();
	const expired = await expiredAt(locationId, today);

	let [quarantine] = await db
		.select({ id: location.id })
		.from(location)
		.where(and(eq(location.kind, 'quarantine'), sql`${location.deletedAt} IS NULL`))
		.orderBy(asc(location.id))
		.limit(1);
	if (!quarantine) {
		await db
			.insert(location)
			.ignore()
			.values({ name: 'Quarantine', kind: 'quarantine', sortOrder: 9 });
		[quarantine] = await db
			.select({ id: location.id })
			.from(location)
			.where(eq(location.kind, 'quarantine'))
			.limit(1);
	}
	return saveDocument(
		{
			header: {
				type: 'transfer',
				docDate: today,
				fromLocationId: locationId,
				toLocationId: quarantine.id,
				note: 'Expired stock pulled off the shelf'
			},
			lines: expired.map((r) => ({
				productId: r.productId,
				quantity: r.quantity,
				lotId: r.lotId,
				note: `Lot ${r.lotNumber}, expired ${r.expiryDate}`
			}))
		},
		actor
	);
}

/** Drafts an expiry write-off of everything expired at a location. Returns the draft's id. */
export async function draftWriteOff(locationId: number, actor: Actor): Promise<number> {
	const today = localToday();
	const expired = await expiredAt(locationId, today);
	return saveDocument(
		{
			header: { type: 'adjustment', docDate: today, fromLocationId: locationId, reason: 'expiry' },
			lines: expired.map((r) => ({
				productId: r.productId,
				quantity: -r.quantity,
				lotId: r.lotId,
				note: `Lot ${r.lotNumber}, expired ${r.expiryDate}`
			}))
		},
		actor
	);
}

/** Pulls a lot off sale (`quarantine`), names it in a recall (`recalled`), or clears it. */
export async function setLotStatus(
	lotId: number,
	status: (typeof LOT_STATUSES)[number],
	note: string | null,
	actor: Actor
) {
	await transaction(async (tx) => {
		const [lot] = await tx.select().from(stockLot).where(eq(stockLot.id, lotId)).for('update');
		if (!lot) throw new WriteRefused(null, 'That lot does not exist.');
		if (lot.status === status) return;
		await tx
			.update(stockLot)
			.set({ status, note: note?.trim() || lot.note })
			.where(eq(stockLot.id, lotId));
		await recordAudit(tx, actor, {
			table: 'stock_lot',
			recordId: lotId,
			action: 'update',
			before: { status: lot.status },
			after: { status }
		});
	});
}
