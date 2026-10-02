import { z } from 'zod/v4';
import { ORDER_STATUSES, REGISTRATION_STATUSES } from '$lib/constants';
import { MANUAL_REASONS } from '$lib/stock';

/** Staff forms that are not plain CRUD. Shared by the page (field errors) and the action. */

export const orderStatusSchema = z.object({
	to: z.enum(ORDER_STATUSES),
	note: z.string().trim().max(255).default('')
});

export const registrationStatusSchema = z.object({
	to: z.enum(REGISTRATION_STATUSES),
	note: z.string().trim().max(255).default('')
});

export const paymentIdSchema = z.object({ paymentId: z.coerce.number().int().positive() });

export const rejectReceiptSchema = z.object({
	paymentId: z.coerce.number().int().positive(),
	reason: z.string().trim().min(3, 'Say why, for the customer and the record').max(200)
});

export const MANUAL_PROVIDERS = ['cash', 'bank_transfer', 'telebirr'] as const;

export const manualPaymentSchema = z.object({
	provider: z.enum(MANUAL_PROVIDERS).default('cash'),
	reference: z.string().trim().max(100).default(''),
	receipt: z
		.instanceof(File)
		.refine((f) => f.size <= 10 * 1024 * 1024, 'Up to 10 MB')
		.optional()
});

export const stockAdjustSchema = z
	.object({
		/** Set by the stock page, where one dialog serves every row; the product page uses its URL. */
		productId: z.coerce.number().int().optional(),
		/** Where the change happens; empty is the shop floor. */
		locationId: z.preprocess(
			(v) => (v === '' || v === null || v === undefined || v === '0' || v === 0 ? undefined : v),
			z.coerce.number().int().positive().optional()
		),
		mode: z.enum(['move', 'count']).default('move'),
		reason: z.enum(MANUAL_REASONS as [string, ...string[]]).default('delivery'),
		qty: z.coerce.number().int().default(0),
		counted: z.coerce.number().int().min(0, 'A count cannot be negative').default(0),
		note: z.string().trim().max(255).default('')
	})
	.superRefine((data, ctx) => {
		if (data.mode === 'move' && data.qty === 0) {
			ctx.addIssue({ code: 'custom', path: ['qty'], message: 'Enter how many' });
		}
	});
