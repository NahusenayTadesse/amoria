/**
 * Every closed list the app uses — the `mysqlEnum` columns, the zod schemas and the kit's status
 * badges all read them from here, so a value added in one place is added everywhere.
 *
 * No server imports: the storefront and the dashboard import this too.
 */

export const LOCALES = ['en', 'am'] as const;

/** `user.role`. What kind of account it is; *what staff may do* comes from `roleId` (§4.4). */
export const USER_ROLES = ['customer', 'staff', 'admin'] as const;

export const PRODUCT_KINDS = ['gift', 'rental'] as const;

export const STOCK_REASONS = [
	'sale',
	'sale_cancel',
	'delivery',
	'damage',
	'loss',
	'adjustment',
	'opening'
] as const;

export const FULFILMENTS = ['pickup', 'delivery'] as const;

/**
 * `paid_unfulfillable`: Chapa confirmed a payment after the hold expired and the stock, dates or seat
 * could not be taken again. Staff rebook or refund (§7).
 */
export const ORDER_STATUSES = [
	'pending_payment',
	'paid',
	'preparing',
	'ready',
	'completed',
	'cancelled',
	'expired',
	'paid_unfulfillable'
] as const;

export const RENTAL_STATUSES = [
	'pending_payment',
	'confirmed',
	'out',
	'returned',
	'cancelled',
	'expired',
	'paid_unfulfillable'
] as const;

export const PACKAGE_TIERS = ['basic', 'premium', 'luxury'] as const;

export const CONTACT_CHANNELS = ['whatsapp', 'telegram', 'sms', 'email', 'phone'] as const;

export const QUOTE_REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;

export const QUOTE_STATUSES = [
	'draft',
	'sent',
	'viewed',
	'accepted',
	'deposit_paid',
	'paid',
	'declined',
	'expired',
	'cancelled',
	'superseded'
] as const;

export const INTAKE_STATUSES = ['open', 'closed', 'completed', 'cancelled'] as const;

export const REGISTRATION_STATUSES = [
	'pending_payment',
	'confirmed',
	'cancelled',
	'expired',
	'paid_unfulfillable'
] as const;

export const REGISTRATION_RESULTS = ['pending', 'graduated', 'not_graduated'] as const;

export const PAYMENT_PROVIDERS = ['chapa', 'telebirr', 'cash', 'bank_transfer'] as const;

/** Also the `Payable.kind` values (§7). */
export const PAYMENT_PURPOSES = [
	'order',
	'rental',
	'quote_deposit',
	'quote_balance',
	'registration'
] as const;

export const PAYMENT_STATUSES = ['initiated', 'success', 'failed', 'cancelled'] as const;

export const MESSAGE_CHANNELS = ['sms', 'email', 'telegram'] as const;

export const MESSAGE_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
