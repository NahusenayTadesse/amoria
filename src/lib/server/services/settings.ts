import { z } from 'zod/v4';
import { db } from '$lib/server/db';
import { setting } from '$lib/server/db/schema';
import { cached } from '$lib/server/cache';

/**
 * The business's settings (§5.10), typed. Each key is one `setting` row holding a string; a
 * missing or unreadable row reads as the default here, so a new setting needs no migration and a
 * bad value in one row never takes the others down with it.
 */
const schema = z.object({
	holdMinutes: z.coerce
		.number()
		.int()
		.min(5)
		.max(24 * 60)
		.catch(30),
	quoteValidDays: z.coerce.number().int().min(1).catch(14),
	rentalReminderDays: z.coerce.number().int().min(0).catch(1),
	depositPercent: z.coerce.number().min(0).max(100).catch(50),
	lowStockDefault: z.coerce.number().int().min(0).catch(3),
	/**
	 * Whether the checkout offers delivery at all. On only matters once there are active delivery
	 * areas, which is where the fees live (`delivery_area`).
	 */
	deliveryEnabled: z
		.enum(['true', 'false'])
		.transform((v) => v === 'true')
		.catch(true),
	/** Orders at or above this deliver free; 0 turns free delivery off (`$lib/delivery`). */
	freeDeliveryThreshold: z.coerce.number().min(0).catch(3000),
	/** Above this, the bag says how far the customer is from free delivery. */
	freeDeliverySuggestAt: z.coerce.number().min(0).catch(2000),
	businessPhone: z.string().catch(''),
	whatsappNumber: z.string().catch(''),
	telegramUsername: z.string().catch(''),
	businessEmail: z.string().catch(''),
	address: z.string().catch('Mekanisa, Addis Ababa'),
	mapUrl: z.string().catch(''),
	staffAlertChatId: z.string().catch('')
});

export type Settings = z.infer<typeof schema>;
export const SETTING_KEYS = Object.keys(schema.shape) as (keyof Settings)[];

export function getSettings(): Promise<Settings> {
	return cached('settings', { ttlMs: 5 * 60_000, tags: ['settings'] }, async () => {
		const rows = await db.select({ key: setting.key, value: setting.value }).from(setting);
		const raw = Object.fromEntries(rows.map((row) => [row.key, row.value]));
		// Every field has a `.catch`, so this never throws: absent keys come back as defaults.
		return schema.parse(raw);
	});
}

/** The contact details the public pages show, from Settings. */
export function publicContact(settings: Settings) {
	return {
		phone: settings.businessPhone,
		whatsapp: settings.whatsappNumber,
		telegram: settings.telegramUsername,
		email: settings.businessEmail,
		address: settings.address,
		mapUrl: settings.mapUrl
	};
}
