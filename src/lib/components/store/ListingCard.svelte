<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Images from '@lucide/svelte/icons/images';
	import Package from '@lucide/svelte/icons/package';
	import Truck from '@lucide/svelte/icons/truck';
	import Users from '@lucide/svelte/icons/users';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { priceText } from '$lib/marketText';
	import type { ListingCard } from '$lib/server/services/marketplace';
	import VerifiedBadge from './VerifiedBadge.svelte';

	/**
	 * A renter's rental on the marketplace: its photo, what it is, its price (or "price on
	 * request"), and whose it is. The whole card links to the rental; there is no bag here, as
	 * marketplace rentals are booked one at a time ("Book now") or quoted.
	 */
	type Props = { listing: ListingCard; eager?: boolean; showRenter?: boolean };
	let { listing, eager = false, showRenter = true }: Props = $props();

	const name = $derived(localized(listing, 'name'));
	const summary = $derived(localized(listing, 'summary'));
	const category = $derived(
		localized({ name: listing.categoryName, nameAm: listing.categoryNameAm }, 'name')
	);
	const renterName = $derived(
		localized({ name: listing.renterName, nameAm: listing.renterNameAm }, 'name')
	);
	const price = $derived(priceText(listing));
	const alt = $derived(
		listing.image
			? localized({ alt: listing.image.alt, altAm: listing.image.altAm }, 'alt') || name
			: name
	);
	/** Live for under two weeks. */
	const isNew = $derived(
		listing.publishedAt != null &&
			Date.now() - new Date(listing.publishedAt).getTime() < 14 * 86_400_000
	);
</script>

<article
	class="listing group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_28px_56px_-34px_var(--am-ink)]"
>
	<div class="relative aspect-[4/3] overflow-hidden bg-secondary">
		{#if listing.image}
			<img
				src={publicFileUrl(listing.image.fileName)}
				{alt}
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="640"
				height="480"
				class="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
			/>
		{:else}
			<div class="listing-art absolute inset-0 grid place-items-center" aria-hidden="true">
				<Package class="h-14 w-14 text-white/90" />
			</div>
		{/if}
		<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
			<span class="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--am-ink)]">
				{category}
			</span>
			{#if isNew}
				<span
					class="rounded-full bg-[var(--am-foil)] px-3 py-1 text-xs font-semibold text-[var(--am-ink)]"
				>
					{m.market_new()}
				</span>
			{/if}
		</div>
		{#if listing.photoCount > 1}
			<span
				class="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white"
			>
				<Images class="h-3.5 w-3.5" aria-hidden="true" />
				{listing.photoCount}
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col p-5">
		{#if showRenter}
			<div class="flex items-center gap-2 text-sm">
				{#if listing.renterLogo}
					<img
						src={publicFileUrl(listing.renterLogo)}
						alt=""
						class="h-6 w-6 rounded-full border object-cover"
						loading="lazy"
					/>
				{/if}
				<span class="truncate font-medium text-muted-foreground">{renterName}</span>
				<VerifiedBadge compact />
			</div>
		{/if}
		<h3 class="display mt-2 text-xl leading-tight font-bold">
			<!-- The whole card is the link. -->
			<a
				href={resolve(localizeHref(`/rentals/${listing.slug}`) as AppPath)}
				class="after:absolute after:inset-0 after:content-['']"
			>
				{name}
			</a>
		</h3>
		{#if summary}
			<p class="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{summary}</p>
		{/if}

		<ul class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
			{#if listing.capacity}
				<li class="inline-flex items-center gap-1">
					<Users class="h-3.5 w-3.5 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.spaces_capacity({ count: listing.capacity })}
				</li>
			{/if}
			{#if listing.deliveryAvailable}
				<li class="inline-flex items-center gap-1">
					<Truck class="h-3.5 w-3.5 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.market_delivery()}
				</li>
			{/if}
			{#if listing.setupIncluded}
				<li class="inline-flex items-center gap-1">
					<Wrench class="h-3.5 w-3.5 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.market_setup()}
				</li>
			{/if}
		</ul>

		<div class="mt-auto flex items-end justify-between gap-3 pt-5">
			<div>
				<p class="display text-lg font-bold tabular-nums">{price.amount}</p>
				{#if price.unit}<p class="text-xs text-muted-foreground">{price.unit}</p>{/if}
			</div>
			<span
				class="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-sm font-semibold transition-colors group-hover:bg-[var(--am-ribbon)] group-hover:text-white"
			>
				{listing.pricing === 'fixed' ? m.market_book_now() : m.market_ask_quote()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</div>
	</div>
</article>

<style>
	.listing-art {
		background:
			radial-gradient(circle at 25% 30%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 78% 72%, #d4a23a, transparent 55%), #1d5b3d;
	}
</style>
