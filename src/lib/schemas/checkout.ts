import { z } from 'zod/v4';
import { isEthiopianPhone } from '@nahu/admin-kit/phone';
import { m } from '$lib/paraglide/messages.js';

/**
 * The shop's checkout and the status page's "pay by transfer" form. Shared by the browser (field
 * errors as you type) and the server (the validation that counts).
 *
 * Messages are functions so they are read in the viewer's language at validation time.
 */

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
/** Screenshots from any phone, and PDFs from online banking. */
const RECEIPT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/heic',
	'image/heif',
	'application/pdf'
];

export const PAYMENT_METHODS = ['chapa', 'transfer'] as const;
export const FULFILMENTS = ['pickup', 'delivery'] as const;

const receipt = z
	.instanceof(File, { error: () => m.checkout_receipt_required() })
	.refine((file) => file.size > 0, { error: () => m.checkout_receipt_required() })
	.refine((file) => file.size <= MAX_RECEIPT_BYTES, { error: () => m.checkout_receipt_too_big() })
	.refine((file) => RECEIPT_TYPES.includes(file.type), { error: () => m.checkout_receipt_type() });

/** The bag, posted as JSON in a hidden field and re-read on the server; never trusted for prices. */
export const cartLines = z
	.array(
		z.object({
			productId: z.number().int().positive(),
			qty: z.number().int().min(1).max(20)
		})
	)
	.min(1)
	.max(20);

/** How the guest pays, on any page that takes a payment (checkout, registration). */
export const paymentFields = {
	method: z.enum(PAYMENT_METHODS).default('chapa'),
	bankAccountId: z.coerce.number().int().optional(),
	receipt: receipt.optional()
};

/** A transfer needs the account it went to and its receipt. */
export function requireTransferProof(
	data: { method: (typeof PAYMENT_METHODS)[number]; bankAccountId?: number; receipt?: File },
	ctx: z.RefinementCtx
) {
	if (data.method !== 'transfer') return;
	if (!data.bankAccountId) {
		ctx.addIssue({
			code: 'custom',
			path: ['bankAccountId'],
			message: m.checkout_account_required()
		});
	}
	if (!data.receipt || data.receipt.size === 0) {
		ctx.addIssue({ code: 'custom', path: ['receipt'], message: m.checkout_receipt_required() });
	}
}

/** The name, phone and optional email every guest form asks for. */
export const contactFields = {
	name: z
		.string()
		.trim()
		.min(2, { error: () => m.checkout_name_required() })
		.max(120),
	phone: z
		.string()
		.trim()
		.refine(isEthiopianPhone, { error: () => m.checkout_phone_invalid() }),
	email: z.union([z.literal(''), z.email({ error: () => m.checkout_email_invalid() })]).default('')
};

export const checkoutSchema = z
	.object({
		cart: z.string().default('[]'),
		...contactFields,
		notes: z.string().trim().max(500).default(''),
		fulfilment: z.enum(FULFILMENTS).default('pickup'),
		/** Delivery only. Whether the area is delivered to, and its fee, is decided on the server. */
		deliveryAreaId: z.coerce.number().int().optional(),
		deliveryAddress: z.string().trim().max(255).default(''),
		...paymentFields
	})
	.superRefine((data, ctx) => {
		if (data.fulfilment === 'delivery') {
			if (!data.deliveryAreaId) {
				ctx.addIssue({
					code: 'custom',
					path: ['deliveryAreaId'],
					message: m.checkout_delivery_area_required()
				});
			}
			if (data.deliveryAddress.length < 5) {
				ctx.addIssue({
					code: 'custom',
					path: ['deliveryAddress'],
					message: m.checkout_delivery_address_required()
				});
			}
		}
		requireTransferProof(data, ctx);
	});

/** "Pay by transfer instead", on a status page. */
export const transferSchema = z.object({
	bankAccountId: z.coerce
		.number({ error: () => m.checkout_account_required() })
		.int()
		.positive(),
	receipt
});
