/**
 * Every closed list the app uses — the `mysqlEnum` columns, the zod schemas and the kit's status
 * badges all read them from here, so a value added in one place is added everywhere.
 *
 * No server imports: the storefront and the dashboard import this too.
 */

export const LOCALES = ['en', 'am'] as const;

/** `user.role`. What kind of account it is; *what staff may do* comes from `roleId` (§4.4). */
export const USER_ROLES = ['customer', 'staff', 'admin'] as const;

/**
 * What a product is. `material` is stock the company uses rather than sells online: décor
 * materials, school supplies, packaging. It is counted, bought and issued like the rest and is
 * never shown on the storefront.
 */
export const PRODUCT_KINDS = ['gift', 'rental', 'material'] as const;

export const STOCK_REASONS = [
	'sale',
	'sale_cancel',
	'delivery',
	'damage',
	'loss',
	'expiry',
	'adjustment',
	'opening',
	'transfer_in',
	'transfer_out',
	'issue',
	'customer_return',
	'supplier_return',
	'pos_sale'
] as const;

/** Where stock physically sits. `quarantine` stock is held back: it is not for sale or issue. */
export const LOCATION_KINDS = ['shop', 'storage', 'workshop', 'quarantine'] as const;

export const LOT_STATUSES = ['available', 'quarantine', 'recalled'] as const;

export const DOCUMENT_TYPES = [
	'receipt',
	'issue',
	'transfer',
	'adjustment',
	'sales_return',
	'purchase_return'
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ['draft', 'posted', 'cancelled'] as const;

/** Why an adjustment document was made. */
export const ADJUSTMENT_REASONS = [
	'count',
	'damage',
	'expiry',
	'found',
	'opening',
	'other'
] as const;

export const TAX_CODES = ['standard', 'zero', 'exempt'] as const;

export const PO_STATUSES = [
	'draft',
	'ordered',
	'partially_received',
	'received',
	'closed',
	'cancelled'
] as const;

export const COUNT_STATUSES = ['open', 'posted', 'cancelled'] as const;

export const REQUISITION_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'issued',
	'cancelled'
] as const;

/** What a requisition is for, so stock used on jobs can be reported by business. */
export const REQUISITION_PURPOSES = ['decor', 'school', 'shop', 'rental', 'other'] as const;

export const SHIFT_STATUSES = ['open', 'closed'] as const;

/** How a walk-in customer paid at the till. */
export const POS_METHODS = ['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card'] as const;

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

/** What a push subscription follows: an order, or a class registration. */
export const PUSH_TARGETS = ['order', 'registration'] as const;

export const PAYMENT_STATUSES = ['initiated', 'success', 'failed', 'cancelled'] as const;

export const MESSAGE_CHANNELS = ['sms', 'email', 'telegram'] as const;

export const MESSAGE_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;

/** What a spreadsheet import can bring in (`services/inventory/importer`). */
export const IMPORT_KIND_NAMES = ['products', 'suppliers', 'opening'] as const;
