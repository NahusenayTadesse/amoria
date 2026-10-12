<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import Phone from '@lucide/svelte/icons/phone';
	import * as RadioGroup from '@nahu/admin-kit/components/ui/radio-group/index.js';
	import { m } from '$lib/paraglide/messages.js';
	import { CONTACT_CHANNELS } from '$lib/constants';
	import { BRAND_ICONS } from '$lib/brandIcons';

	type Channel = (typeof CONTACT_CHANNELS)[number];

	/**
	 * "How should we reach you?" as a row of tiles: the WhatsApp and Telegram logos, and icons for a
	 * text, an email and a call. The kit's radio group underneath, named `name`, so the form posts
	 * the choice as a select would, and the arrow keys and screen readers treat it as one group.
	 */
	type Props = { value: Channel; name: string; labelledBy: string };
	let { value = $bindable(), name, labelledBy }: Props = $props();

	const label: Record<Channel, () => string> = {
		whatsapp: m.quote_channel_whatsapp,
		telegram: m.quote_channel_telegram,
		sms: m.quote_channel_sms,
		email: m.quote_channel_email,
		phone: m.quote_channel_phone
	};
	const icons = { sms: MessageSquareText, email: Mail, phone: Phone } as const;
</script>

<RadioGroup.Root
	{name}
	bind:value={() => value, (v) => (value = v as Channel)}
	aria-labelledby={labelledBy}
	class="grid grid-cols-3 gap-2.5 sm:grid-cols-5"
>
	{#each CONTACT_CHANNELS as channel (channel)}
		<label
			for="channel-{channel}"
			class="group flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.1rem] border border-input bg-card px-2 py-3 text-center text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[[data-state=checked]]:border-[var(--am-ribbon)] has-[[data-state=checked]]:bg-[color-mix(in_oklab,var(--am-ribbon)_8%,var(--card))] has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-[var(--am-ribbon)]"
		>
			<RadioGroup.Item id="channel-{channel}" value={channel} class="sr-only" />
			{#if channel === 'whatsapp' || channel === 'telegram'}
				<svg
					viewBox="0 0 24 24"
					class="h-8 w-8 transition-transform duration-200 group-has-[[data-state=checked]]:scale-110"
					fill={BRAND_ICONS[channel].color}
					aria-hidden="true"
				>
					<path d={BRAND_ICONS[channel].path} />
				</svg>
			{:else}
				{@const Icon = icons[channel]}
				<Icon
					class="h-8 w-8 text-[var(--am-ribbon)] transition-transform duration-200 group-has-[[data-state=checked]]:scale-110"
					aria-hidden="true"
				/>
			{/if}
			<span class="leading-tight">{label[channel]()}</span>
		</label>
	{/each}
</RadioGroup.Root>
