<script lang="ts">
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Store from '@lucide/svelte/icons/store';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { yearsIn } from '$lib/marketText';
	import type { RenterCard } from '$lib/server/services/marketplace';
	import VerifiedBadge from './VerifiedBadge.svelte';

	/** A renter in the directory: cover, logo, name, what they are known for, their numbers. */
	type Props = { renter: RenterCard; eager?: boolean };
	let { renter, eager = false }: Props = $props();

	const name = $derived(
		localized({ name: renter.businessName, nameAm: renter.businessNameAm }, 'name')
	);
	const tagline = $derived(localized(renter, 'tagline'));
	const years = $derived(yearsIn(renter.foundedYear));
</script>

<article
	class="group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_28px_56px_-34px_var(--am-ink)]"
>
	<div class="relative h-32 overflow-hidden bg-secondary">
		{#if renter.coverFile}
			<img
				src={publicFileUrl(renter.coverFile)}
				alt=""
				loading={eager ? 'eager' : 'lazy'}
				class="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"
			/>
		{:else}
			<div class="cover-art absolute inset-0" aria-hidden="true"></div>
		{/if}
		{#if renter.isFeatured}
			<span
				class="absolute top-3 right-3 rounded-full bg-[var(--am-foil)] px-3 py-1 text-xs font-semibold text-[var(--am-ink)]"
			>
				{m.market_featured()}
			</span>
		{/if}
	</div>
	<div class="relative flex flex-1 flex-col px-5 pb-5">
		<div
			class="-mt-9 grid h-18 w-18 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-secondary shadow-sm"
		>
			{#if renter.logoFile}
				<img
					src={publicFileUrl(renter.logoFile)}
					alt=""
					class="h-full w-full object-cover"
					loading="lazy"
				/>
			{:else}
				<Store class="h-8 w-8 text-[var(--am-ribbon)]" aria-hidden="true" />
			{/if}
		</div>
		<h3 class="display mt-3 text-xl leading-tight font-bold">
			<a
				href={resolve(localizeHref(`/renters/${renter.slug}`) as AppPath)}
				class="after:absolute after:inset-0 after:content-['']"
			>
				{name}
			</a>
		</h3>
		<VerifiedBadge class="mt-1" compact />
		{#if tagline}<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">{tagline}</p>{/if}
		{#if renter.area}
			<p class="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
				<MapPin class="h-3.5 w-3.5" aria-hidden="true" />
				{renter.area}
			</p>
		{/if}
		<dl class="mt-auto grid grid-cols-3 gap-2 border-t pt-4 text-center">
			<div>
				<dt class="text-[0.7rem] text-muted-foreground">{m.market_stat_rentals()}</dt>
				<dd class="display text-lg font-bold">{renter.listingCount}</dd>
			</div>
			<div>
				<dt class="text-[0.7rem] text-muted-foreground">{m.market_stat_completed()}</dt>
				<dd class="display text-lg font-bold">{renter.completedCount}</dd>
			</div>
			<div>
				<dt class="text-[0.7rem] text-muted-foreground">{m.market_stat_years()}</dt>
				<dd class="display text-lg font-bold">{years ?? '–'}</dd>
			</div>
		</dl>
	</div>
</article>

<style>
	.cover-art {
		background:
			radial-gradient(circle at 20% 40%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 85% 60%, #d4a23a, transparent 50%), #1d5b3d;
	}
</style>
