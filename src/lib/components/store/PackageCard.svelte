<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import type { ClassValue } from 'svelte/elements';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { birr, localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import type { HomePackage } from '$lib/server/services/home';

	/**
	 * A décor package: its photo and tier, kind of event, what it includes and what it starts at.
	 * "Learn more" opens the quote form with this package already chosen.
	 */
	type Props = { pack: HomePackage; index?: number; class?: ClassValue };
	let { pack, index = 0, class: className }: Props = $props();

	const tiers = {
		basic: m.home_tier_basic,
		premium: m.home_tier_premium,
		luxury: m.home_tier_luxury
	};

	const name = $derived(localized(pack, 'name'));
	const summary = $derived(localized(pack, 'summary'));
	const inclusions = $derived(
		getLocale() === 'am' && pack.inclusionsAm.length ? pack.inclusionsAm : pack.inclusions
	);
	const quote = $derived(
		`${resolve(localizeHref('/decor/quote') as AppPath)}?package=${encodeURIComponent(pack.slug)}#quote-form`
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the quote link is resolved above, then given a query and #anchor -->
<article
	use:reveal
	style="--i: {index}"
	class={[
		'pack group flex flex-col overflow-hidden rounded-[1.5rem] border bg-card transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-32px_var(--am-ink)]',
		pack.tier === 'premium' ? 'border-[var(--am-foil)]' : 'border-border',
		className
	]}
>
	<div class="relative aspect-[4/3] overflow-hidden bg-secondary">
		{#if pack.image}
			<img
				src={publicFileUrl(pack.image)}
				alt={pack.imageAlt ?? name}
				loading="lazy"
				decoding="async"
				width="640"
				height="480"
				class="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
			/>
		{:else}
			<div class={['pack-art absolute inset-0', `tier-${pack.tier}`]} aria-hidden="true"></div>
		{/if}
		<span
			class="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold tracking-wide text-[var(--am-ink)] uppercase"
		>
			{tiers[pack.tier]()}
		</span>
	</div>
	<div class="flex flex-1 flex-col p-6">
		<p class="text-xs font-semibold tracking-[0.18em] text-[var(--am-foil)] uppercase">
			{localized({ name: pack.eventName, nameAm: pack.eventNameAm }, 'name')}
		</p>
		<h3 class="display mt-1 text-2xl font-bold">{name}</h3>
		{#if summary}<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">
				{summary}
			</p>{/if}
		{#if inclusions.length}
			<ul class="mt-4 space-y-2 text-sm">
				{#each inclusions as item, i (i)}
					<li class="flex gap-2.5">
						<Check
							class="mt-0.5 h-4 w-4 shrink-0 text-[var(--am-ribbon)]"
							aria-hidden="true"
						/>{item}
					</li>
				{/each}
			</ul>
		{/if}
		<div class="mt-auto flex items-end justify-between gap-3 pt-6">
			<div>
				<p class="text-xs text-muted-foreground">{m.home_packages_from()}</p>
				<p class="display text-xl font-bold tabular-nums">{birr(pack.startingPrice)}</p>
			</div>
			<a
				href={quote}
				aria-label="{m.home_packages_ask()}: {name}"
				class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-foreground/30 px-4 text-sm font-semibold whitespace-nowrap transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
			>
				{m.home_packages_ask()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</a>
		</div>
	</div>
</article>

<style>
	.pack-art.tier-basic {
		background:
			radial-gradient(circle at 30% 30%, #bfdcc9, transparent 55%),
			radial-gradient(circle at 75% 70%, #c9dccd, transparent 55%), var(--secondary);
	}
	.pack-art.tier-premium {
		background:
			radial-gradient(circle at 28% 32%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 76% 72%, #f6dc95, transparent 55%), #bfdcc9;
	}
	.pack-art.tier-luxury {
		background:
			radial-gradient(circle at 30% 30%, #3f8a63, transparent 55%),
			radial-gradient(circle at 74% 74%, #d4a23a, transparent 55%), #1d5b3d;
	}
	.pack-art {
		transition: transform 0.9s ease;
	}
	.pack:hover .pack-art {
		transform: scale(1.08);
	}
</style>
