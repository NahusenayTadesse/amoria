import { toast } from 'svelte-sonner';
import { localizeHref } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages.js';

/** A product's own link: the shop with its sheet open. */
export const productLink = (slug: string) =>
	location.origin + localizeHref(`/shop?product=${encodeURIComponent(slug)}`);

/** The direct-buy link: `/buy/[slug]` puts the gift in the bag and opens checkout. */
export const buyLink = (slug: string) =>
	location.origin + localizeHref(`/buy/${encodeURIComponent(slug)}`);

/** A whole bag as a link: `?cart=slug.qty,slug.qty`. Opening it fills the bag and checks out. */
export const cartLink = (lines: { slug: string; qty: number }[]) =>
	location.origin +
	localizeHref(
		`/shop?cart=${lines.map((l) => `${encodeURIComponent(l.slug)}.${l.qty}`).join(',')}`
	);

/** Reads `?cart=` back. Anything malformed is dropped. */
export function parseCart(value: string): { slug: string; qty: number }[] {
	return value.split(',').flatMap((part) => {
		const dot = part.lastIndexOf('.');
		const qty = Number(part.slice(dot + 1));
		const slug = decodeURIComponent(part.slice(0, dot));
		return dot > 0 && slug && Number.isInteger(qty) && qty > 0 ? [{ slug, qty }] : [];
	});
}

function copyWithSelection(text: string): boolean {
	const field = document.createElement('textarea');
	field.value = text;
	field.setAttribute('readonly', '');
	field.style.position = 'fixed';
	field.style.opacity = '0';
	document.body.append(field);
	field.select();
	try {
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		field.remove();
	}
}

/**
 * The phone's share sheet where there is one (WhatsApp, Telegram, SMS…); otherwise the link goes
 * to the clipboard and a toast says so. Works over plain HTTP and in in-app browsers too.
 */
export async function shareLink(data: { title: string; text: string; url: string }) {
	if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
		try {
			await navigator.share(data);
			return;
		} catch (error) {
			if ((error as Error)?.name === 'AbortError') return; // They closed the sheet.
		}
	}
	let ok = false;
	if (navigator.clipboard && window.isSecureContext) {
		ok = await navigator.clipboard.writeText(data.url).then(
			() => true,
			() => false
		);
	}
	if (!ok) ok = copyWithSelection(data.url);
	if (ok) toast.success(m.share_copied());
	else toast.error(m.share_failed());
}
