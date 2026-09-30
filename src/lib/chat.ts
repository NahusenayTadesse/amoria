/**
 * WhatsApp and Telegram deep links with the message already typed (§12.2 `ChatButtons`), so a
 * customer who taps one only has to press send. Both return `null` until the shop's number or
 * handle is saved in Settings, and callers fall back to the contact section.
 */

/** `+251 91 123 4567` → `251911234567`, as wa.me wants it. */
function digits(phone: string): string {
	return phone.replace(/\D/g, '');
}

export function whatsappHref(number: string, text: string): string | null {
	const to = digits(number);
	return to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : null;
}

export function telegramHref(username: string, text: string): string | null {
	const handle = username
		.trim()
		.replace(/^@/, '')
		.replace(/^https?:\/\/t\.me\//, '');
	return handle ? `https://t.me/${handle}?text=${encodeURIComponent(text)}` : null;
}

export function telHref(phone: string): string | null {
	const to = phone.replace(/[^\d+]/g, '');
	return to ? `tel:${to}` : null;
}

/**
 * Where an "ask us" button goes: a chat with the message already typed, WhatsApp first. `null`
 * until the shop has saved a number or handle in Settings; callers then fall back to `/contact`.
 */
export function chatHref(contact: { whatsapp: string; telegram: string }, text: string) {
	return whatsappHref(contact.whatsapp, text) ?? telegramHref(contact.telegram, text);
}
