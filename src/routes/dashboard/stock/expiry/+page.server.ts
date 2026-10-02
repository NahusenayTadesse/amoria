import { fail, redirect } from '@sveltejs/kit';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { LOT_STATUSES } from '$lib/constants';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt } from '$lib/server/attempt';
import {
	draftQuarantine,
	draftWriteOff,
	expiryReport,
	setLotStatus
} from '$lib/server/services/inventory/expiry';
import { getSettings } from '$lib/server/services/settings';

/** Lots that have expired, will soon, or were pulled or recalled, by location. */
export const load = async ({ locals }) => {
	const settings = await getSettings();
	const rows = await expiryReport();
	const byLocation = new Map<
		number,
		{ id: number; name: string; kind: string; rows: typeof rows; expired: number }
	>();
	for (const r of rows) {
		const g = byLocation.get(r.locationId) ?? {
			id: r.locationId,
			name: r.location,
			kind: r.locationKind,
			rows: [],
			expired: 0
		};
		g.rows.push(r);
		if (r.state === 'expired') g.expired += 1;
		byLocation.set(r.locationId, g);
	}
	return {
		groups: [...byLocation.values()],
		warningDays: settings.expiryWarningDays,
		canAct: hasPermission(locals, 'stock.adjust')
	};
};

export const actions = {
	/** Drafts a transfer of what has expired at a location into quarantine, and opens it. */
	quarantine: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const locationId = Number((await event.request.formData()).get('locationId'));
		let id: number | null = null;
		const result = await attempt(async () => {
			id = await draftQuarantine(locationId, actorOf(event));
		}, 'Transfer drafted');
		if ('data' in result || id === null) return result;
		redirect(303, `/dashboard/stock/documents/${id}`);
	},

	/** Drafts a write-off of what has expired at a location, and opens it. */
	writeOff: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const locationId = Number((await event.request.formData()).get('locationId'));
		let id: number | null = null;
		const result = await attempt(async () => {
			id = await draftWriteOff(locationId, actorOf(event));
		}, 'Write-off drafted');
		if ('data' in result || id === null) return result;
		redirect(303, `/dashboard/stock/documents/${id}`);
	},

	/** Pulls a lot off sale, names it in a recall, or clears it. */
	lot: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const data = await event.request.formData();
		const lotId = Number(data.get('lotId'));
		const status = String(data.get('status'));
		if (!Number.isInteger(lotId) || !(LOT_STATUSES as readonly string[]).includes(status)) {
			return fail(400, { error: 'Choose what to do with the lot.' });
		}
		return attempt(
			() =>
				setLotStatus(
					lotId,
					status as (typeof LOT_STATUSES)[number],
					String(data.get('note') ?? '') || null,
					actorOf(event)
				),
			'Lot updated'
		);
	}
};
