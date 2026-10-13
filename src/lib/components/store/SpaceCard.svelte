<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Building2 from '@lucide/svelte/icons/building-2';
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';
	import Images from '@lucide/svelte/icons/images';
	import Play from '@lucide/svelte/icons/play';
	import Users from '@lucide/svelte/icons/users';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { birr, localized } from '$lib/localized';
	import type { SpaceCard } from '$lib/server/services/spaces';

	type Props = { space: SpaceCard; eager?: boolean };
	let { space, eager = false }: Props = $props();

	const href = $derived(resolve(localizeHref(`/spaces/${space.slug}`) as AppPath));
	const name = $derived(localized(space, 'name'));
	const summary = $derived(localized(space, 'summary'));
	const unit = $derived(localized(space, 'priceUnit'));
	const alt = $derived(
		space.image
			? localized({ alt: space.image.alt, altAm: space.image.altAm }, 'alt') || name
			: name
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- `href` is resolved; `#book` is its form -->
<article
	class="space group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_32px_60px_-34px_var(--am-ink)]"
>
	<div class="relative aspect-[16/10] overflow-hidden bg-secondary">
		{#if space.image}
			<img
				src={publicFileUrl(space.image.fileName)}
				{alt}
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="640"
				height="400"
				class="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
			/>
		{:else}
			<div class="space-art absolute inset-0 grid place-items-center" aria-hidden="true">
				<Building2 class="h-16 w-16 text-white/90" />
			</div>
		{/if}
		<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
			{#if space.photoCount > 1}
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--am-ink)]"
				>
					<Images class="h-3.5 w-3.5" aria-hidden="true" />
					{m.spaces_photos({ count: space.photoCount })}
				</span>
			{/if}
			{#if space.youtubeUrl}
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--am-ink)]"
				>
					<Play class="h-3.5 w-3.5 fill-current" aria-hidden="true" />
					{m.spaces_has_video()}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex flex-1 flex-col p-6">
		<h3 class="display text-2xl leading-tight font-bold">
			<!-- The whole card opens the space; the buttons below take the keyboard. -->
			<a {href} tabindex="-1" class="after:absolute after:inset-0 after:content-['']">
				{name}
			</a>
		</h3>
		{#if summary}
			<p class="mt-2 line-clamp-3 text-sm text-muted-foreground">{summary}</p>
		{/if}

		<div class="mt-auto flex flex-wrap items-end justify-between gap-3 pt-6">
			<div>
				{#if space.price != null}
					<p class="display text-xl font-bold tabular-nums">
						{m.spaces_price_from({ price: birr(space.price) })}
					</p>
					{#if unit}<p class="text-xs text-muted-foreground">{unit}</p>{/if}
				{:else}
					<p class="text-sm font-semibold">{m.spaces_price_ask()}</p>
				{/if}
			</div>
			{#if space.capacity}
				<span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
					<Users class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.spaces_capacity({ count: space.capacity })}
				</span>
			{/if}
		</div>
		<!-- Above the card's own link, so each goes where it says. -->
		<div class="relative z-10 mt-5 flex flex-col gap-2">
			<a
				{href}
				class="group/see inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-foreground/25 px-4 text-sm font-semibold transition-colors hover:border-foreground"
			>
				{m.spaces_view()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover/see:translate-x-1"
					aria-hidden="true"
				/>
			</a>
			<a
				href={`${href}#book`}
				class="btn-shine inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--am-ribbon)] px-4 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
			>
				<CalendarCheck class="h-4 w-4" aria-hidden="true" />
				{m.spaces_card_book()}
			</a>
		</div>
	</div>
</article>

<style>
	.space-art {
		background:
			radial-gradient(circle at 25% 30%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 78% 72%, #d4a23a, transparent 55%), #1d5b3d;
		transition: transform 0.9s ease;
	}
	.space:hover .space-art {
		transform: scale(1.08);
	}
</style>
