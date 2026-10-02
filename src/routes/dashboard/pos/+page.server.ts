import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { checkoutPayload, closeShiftSchema, openShiftSchema } from '$lib/schemas/inventory';
import { POS_METHOD_LABELS } from '$lib/stock';
import { actorOf } from '$lib/server/paymentAdmin';
import {
	checkout,
	closeShift,
	currentShift,
	openShift,
	shiftSummary
} from '$lib/server/services/inventory/pos';
import { getSettings } from '$lib/server/services/settings';

/**
 * The till. Without an open shift it asks for the float; with one it is the selling screen (the
 * basket lives in the browser, and the whole sale is posted in one go by `?/sell`).
 */
export const load = async ({ locals }) => {
	const shift = await currentShift(locals.user!.id);
	const settings = await getSettings();
	return {
		shift: shift
			? {
					id: shift.id,
					location: shift.location,
					locationId: shift.locationId,
					openedAt: shift.openedAt
				}
			: null,
		summary: shift ? await shiftSummary(shift.id) : null,
		canDiscount: hasPermission(locals, 'pos.discount'),
		vat: {
			registered: settings.vatRegistered,
			rate: settings.vatRate,
			included: settings.pricesIncludeVat
		},
		methods: Object.entries(POS_METHOD_LABELS).map(([value, name]) => ({ value, name })),
		openForm: shift ? null : await superValidate({ floatAmount: 0 }, zod4(openShiftSchema)),
		closeForm: shift ? await superValidate(zod4(closeShiftSchema)) : null
	};
};

export const actions = {
	open: async (event) => {
		const form = await superValidate(event.request, zod4(openShiftSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await openShift({ floatAmount: form.data.floatAmount }, actorOf(event));
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Till open' });
	},

	/** One sale: the basket and how it was paid arrive as one JSON field. */
	sell: async (event) => {
		const data = await event.request.formData();
		let parsed;
		try {
			parsed = checkoutPayload.safeParse(JSON.parse(String(data.get('payload') ?? '')));
		} catch {
			return fail(400, { error: 'The basket could not be read. Try again.' });
		}
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Check the basket.' });
		}
		try {
			const sale = await checkout(
				{
					lines: parsed.data.lines,
					payments: parsed.data.payments,
					canDiscount: hasPermission(event.locals, 'pos.discount')
				},
				actorOf(event)
			);
			return { done: `Sold: ${sale.number}`, sale };
		} catch (err) {
			if (err instanceof WriteRefused) return fail(409, { error: err.message });
			throw err;
		}
	},

	close: async (event) => {
		const shift = await currentShift(event.locals.user!.id);
		const form = await superValidate(event.request, zod4(closeShiftSchema));
		if (!form.valid) return fail(400, { form });
		if (!shift) return message(form, { type: 'error', text: 'No till is open.' }, { status: 409 });
		try {
			await closeShift(
				shift.id,
				{ countedCash: form.data.countedCash, note: form.data.note || null },
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/dashboard/pos/shifts/${shift.id}`);
	}
};
