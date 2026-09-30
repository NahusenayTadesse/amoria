import { and, asc, eq } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { deliveryArea } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';
import { deliveryFee, type FreeDelivery } from '$lib/delivery';
import { m } from '$lib/paraglide/messages.js';
import { getSettings } from './settings';

export type DeliveryArea = { id: number; name: string; nameAm: string | null; fee: number };

/** The areas delivered to, in the order staff set. Cached; the areas page calls `invalidate('settings')`. */
export function deliveryAreas(): Promise<DeliveryArea[]> {
	return cached('delivery-areas', { ttlMs: 5 * 60_000, tags: ['settings'] }, () =>
		db
			.select({
				id: deliveryArea.id,
				name: deliveryArea.name,
				nameAm: deliveryArea.nameAm,
				fee: deliveryArea.fee
			})
			.from(deliveryArea)
			.where(and(eq(deliveryArea.status, true), notDeleted(deliveryArea)))
			.orderBy(asc(deliveryArea.sortOrder), asc(deliveryArea.name))
	);
}

/** What the storefront needs to offer delivery: whether it is on, the areas, and the free-delivery rule. */
export async function deliveryOptions() {
	const [settings, areas] = await Promise.all([getSettings(), deliveryAreas()]);
	const free: FreeDelivery = {
		threshold: settings.freeDeliveryThreshold,
		suggestAt: settings.freeDeliverySuggestAt
	};
	return { enabled: settings.deliveryEnabled && areas.length > 0, areas, free };
}

/**
 * The fee for delivering an order of `subtotal` to `areaId`, from the database — the number the
 * order is charged, whatever the browser showed. Refuses an area that is not (or no longer)
 * delivered to, and delivery altogether when it is switched off.
 */
export async function quoteDelivery(areaId: number, subtotal: number) {
	const { enabled, areas, free } = await deliveryOptions();
	const area = areas.find((a) => a.id === areaId);
	if (!enabled || !area) throw new WriteRefused('deliveryAreaId', m.refused_delivery_area());

	return { areaId: area.id, areaName: area.name, fee: deliveryFee(area.fee, subtotal, free) };
}
