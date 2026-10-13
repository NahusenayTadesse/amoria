import type { QUOTE_REQUEST_KINDS, QUOTE_REQUEST_STATUSES } from './constants';

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];
export type QuoteRequestKind = (typeof QUOTE_REQUEST_KINDS)[number];

/** What a request is about, as staff read it. */
export const QUOTE_REQUEST_KIND_LABELS: Record<QuoteRequestKind, string> = {
	decor: 'Décor',
	space: 'Space booking',
	contact: 'Message'
};

export const QUOTE_REQUEST_LABELS: Record<QuoteRequestStatus, string> = {
	new: 'New',
	contacted: 'Contacted',
	quoted: 'Quote sent',
	won: 'Won',
	lost: 'Lost'
};

export const CHANNEL_LABELS: Record<string, string> = {
	whatsapp: 'WhatsApp',
	telegram: 'Telegram',
	sms: 'Text message',
	email: 'Email',
	phone: 'Phone call'
};

/**
 * A contact-page message is not a quote: staff only mark it answered. Its statuses are the first
 * two of a request's, named for a message.
 */
export const MESSAGE_STATUSES = [
	'new',
	'contacted'
] as const satisfies readonly QuoteRequestStatus[];
export const MESSAGE_LABELS: Record<(typeof MESSAGE_STATUSES)[number], string> = {
	new: 'New',
	contacted: 'Replied'
};
