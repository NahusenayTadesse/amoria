import { z } from 'zod/v4';
import { m } from '$lib/paraglide/messages.js';
import { CONTACT_CHANNELS } from '$lib/constants';
import { contactFields } from './checkout';

/** A number field that is left empty: `''` and missing both mean "not given". */
const optionalNumber = <T extends z.ZodType>(schema: T) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? undefined : v),
		schema.optional()
	);

/**
 * "Plan your décor": the request a customer sends for a quote (§5.5). Only the contact details are
 * required; everything else helps staff reply with a price, and is skipped when the guest does
 * not know it yet. Shared by the page's form, the offline-queue endpoint and the service.
 */
export const quoteRequestSchema = z.object({
	...contactFields,
	eventTypeId: optionalNumber(z.coerce.number().int().positive()),
	/** `YYYY-MM-DD`; whether it is in the past is checked on the server, in Addis Ababa's day. */
	eventDate: z
		.union([
			z.literal(''),
			z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => m.quote_date_invalid() })
		])
		.default(''),
	venue: z.string().trim().max(160).default(''),
	guestCount: optionalNumber(z.coerce.number().int().min(1).max(100_000)),
	theme: z.string().trim().max(160).default(''),
	budget: optionalNumber(z.coerce.number().min(0).max(100_000_000)),
	packageId: optionalNumber(z.coerce.number().int().positive()),
	message: z.string().trim().max(1500).default(''),
	preferredChannel: z.enum(CONTACT_CHANNELS).default('phone'),
	/** Set by the browser; see `quote_request.client_ref`. */
	clientRef: z.string().trim().max(40).default('')
});

export type QuoteRequestInput = z.output<typeof quoteRequestSchema>;
