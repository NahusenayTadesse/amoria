import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import { category, location, stockCount, stockDocument } from '$lib/server/db/schema';
import { badge } from '$lib/stock';
import { countFound } from '$lib/schemas/inventory';
import { lotOptions, productOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt } from '$lib/server/attempt';
import {
	addFoundLine,
	cancelCount,
	countLines,
	movedSinceOpened,
	postCount,
	saveCounts
} from '$lib/server/services/inventory/counts';

function countId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Count not found');
	return id;
}

export const load = async ({ params, locals }) => {
	const id = countId(params);
	const [row] = await db
		.select({
			count: stockCount,
			location: location.name,
			category: category.name,
			adjustment: stockDocument.number
		})
		.from(stockCount)
		.innerJoin(location, eq(location.id, stockCount.locationId))
		.leftJoin(category, eq(category.id, stockCount.categoryId))
		.leftJoin(stockDocument, eq(stockDocument.id, stockCount.adjustmentId))
		.where(eq(stockCount.id, id));
	if (!row) error(404, 'Count not found');
	const count = row.count;
	const isOpen = count.status === 'open';
	const canPost = hasPermission(locals, 'stock.adjust');
	// A blind count hides what the system expects from anyone who cannot post it.
	const hideExpected = count.blind && isOpen && !canPost;

	const lines = await countLines(id);
	return {
		count,
		badge: badge(count.status),
		location: row.location,
		category: row.category,
		adjustment: row.adjustment,
		isOpen,
		canPost,
		hideExpected,
		moved: isOpen ? await movedSinceOpened(id) : 0,
		lines: lines.map((l) => ({
			...l,
			expected: hideExpected ? null : l.expected,
			variance: hideExpected ? null : l.variance,
			varianceValue: hideExpected ? null : l.varianceValue
		})),
		found: isOpen
			? {
					products: await productOptions(),
					lots: await lotOptions(),
					form: await superValidate(zod4(countFound))
				}
			: null
	};
};

export const actions = {
	/** Saves every counted box on the page. A blank box is "not counted yet". */
	save: async (event) => {
		const id = countId(event.params);
		const data = await event.request.formData();
		const entries: { lineId: number; counted: number | null }[] = [];
		for (const [key, value] of data.entries()) {
			const m = /^counted_(\d+)$/.exec(key);
			if (!m) continue;
			const text = String(value).trim();
			entries.push({ lineId: Number(m[1]), counted: text === '' ? null : Number(text) });
		}
		return attempt(() => saveCounts(id, entries, actorOf(event)), 'Counts saved');
	},

	found: async (event) => {
		const id = countId(event.params);
		const form = await superValidate(event.request, zod4(countFound));
		if (!form.valid) return fail(400, { form });
		try {
			await addFoundLine(
				{
					countId: id,
					productId: form.data.productId,
					lotId: form.data.lotId ?? null,
					counted: form.data.counted
				},
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Added to the count' });
	},

	post: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		const id = countId(event.params);
		return attempt(async () => {
			const result = await postCount(id, actorOf(event));
			return { lines: result.lines, number: result.number };
		}, 'Count posted. Stock now matches what was counted.');
	},

	cancel: async (event) => {
		requirePermission(event.locals, 'stock.adjust');
		return attempt(() => cancelCount(countId(event.params), actorOf(event)), 'Count cancelled');
	}
};
