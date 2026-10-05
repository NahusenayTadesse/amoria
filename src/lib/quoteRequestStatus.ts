import type { QUOTE_REQUEST_STATUSES } from './constants';

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

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
