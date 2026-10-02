import { eq, sql } from 'drizzle-orm';
import { contentCrud } from '@nahu/admin-kit/server/crud';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { location, stockBalance } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { locationAdd, locationEdit } from '$lib/schemas/inventory';

/**
 * Where stock sits: the shop floor, the store room, the workshop, quarantine. The ledger reads
 * these, so two changes are refused while a location holds stock: switching it off (its stock would
 * vanish from every list) and changing its kind (moving it in or out of quarantine changes what
 * counts as sellable). Move the stock out first.
 */
const crud = contentCrud({
	table: location,
	label: 'Location',
	addSchema: locationAdd,
	editSchema: locationEdit,
	uniqueField: 'name',
	audit: 'location',
	transform: async (values, _event, before) => {
		if (before && (before.kind !== values.kind || (before.status && !values.status))) {
			const [{ held }] = await db
				.select({ held: sql<number>`COALESCE(SUM(${stockBalance.quantity}), 0)` })
				.from(stockBalance)
				.where(eq(stockBalance.locationId, Number(before.id)));
			if (Number(held) > 0) {
				throw new WriteRefused(
					before.kind !== values.kind ? 'kind' : 'status',
					`It still holds ${Number(held)} units. Move them out first.`
				);
			}
		}
		return values;
	}
});

export const load = crud.load;
export const actions = invalidating(['catalog'], crud.actions);
