<script lang="ts">
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Send from '@lucide/svelte/icons/send';
	import { m } from '$lib/paraglide/messages.js';
	import { telegramHref, whatsappHref } from '$lib/chat';

	type Props = {
		whatsapp: string;
		telegram: string;
		/** The message that is already typed when the chat opens. */
		text: string;
		/** `light` for dark backgrounds, `dark` for light ones. */
		tone?: 'light' | 'dark';
	};

	let { whatsapp, telegram, text, tone = 'dark' }: Props = $props();

	const links = $derived(
		[
			{ href: whatsappHref(whatsapp, text), label: m.home_contact_whatsapp(), icon: MessageCircle },
			{ href: telegramHref(telegram, text), label: m.home_contact_telegram(), icon: Send }
		].flatMap((link) => (link.href ? [{ ...link, href: link.href }] : []))
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external chat links, not app routes -->
{#each links as link, index (link.label)}
	{@const Icon = link.icon}
	<a
		href={link.href}
		target="_blank"
		rel="noopener noreferrer"
		class={[
			'group inline-flex h-12 items-center gap-2.5 rounded-full px-6 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5',
			tone === 'light'
				? index === 0
					? 'bg-white text-[var(--am-ink)] hover:shadow-[0_12px_30px_-12px_rgba(255,255,255,0.6)]'
					: 'border border-white/40 text-white hover:border-white hover:bg-white/10'
				: index === 0
					? 'bg-foreground text-background hover:shadow-[0_12px_30px_-12px_var(--am-ink)]'
					: 'border border-foreground/40 text-foreground hover:border-foreground'
		]}
	>
		<Icon
			class="h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]"
			aria-hidden="true"
		/>
		{link.label}
	</a>
{/each}
