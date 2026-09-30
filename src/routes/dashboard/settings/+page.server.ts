import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '$lib/server/db';
import { setting } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/services/settings';
import { invalidate } from '$lib/server/cache';
import { shopSettingsSchema } from '$lib/schemas/catalog';

export const load = async () => {
	const current = await getSettings();
	return { form: await superValidate(current, zod4(shopSettingsSchema)) };
};

export const actions = {
	/**
	 * Writes each setting as its own `setting` row (§5.10), in one transaction, and records what
	 * changed. `getSettings` types them back; the cache is dropped so checkout sees them at once.
	 */
	default: async (event) => {
		const form = await superValidate(event.request, zod4(shopSettingsSchema));
		if (!form.valid)
			return message(
				form,
				{ type: 'error', text: 'Check the highlighted fields.' },
				{ status: 400 }
			);

		const before = await getSettings();
		await db.transaction(async (tx) => {
			for (const [key, value] of Object.entries(form.data)) {
				await tx
					.insert(setting)
					.values({ key, value: String(value), updatedBy: event.locals.user?.id ?? null })
					.onDuplicateKeyUpdate({
						set: { value: String(value), updatedBy: event.locals.user?.id ?? null }
					});
			}
			await recordAudit(tx, event, {
				table: 'setting',
				recordId: 'shop',
				action: 'update',
				before: before as Record<string, unknown>,
				after: form.data
			});
		});
		invalidate('settings');

		return message(form, { type: 'success', text: 'Settings saved' });
	}
};
