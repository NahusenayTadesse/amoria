<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Phone from '@lucide/svelte/icons/phone';
	import Truck from '@lucide/svelte/icons/truck';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import { chatHref, telHref } from '$lib/chat';
	import { yearsIn } from '$lib/marketText';
	import ListingCard from '$lib/components/store/ListingCard.svelte';
	import RentalOrderForm from '$lib/components/store/RentalOrderForm.svelte';
	import VerifiedBadge from '$lib/components/store/VerifiedBadge.svelte';

	let { data } = $props();

	const r = $derived(data.renter);
	const name = $derived(localized({ name: r.businessName, nameAm: r.businessNameAm }, 'name'));
	const tagline = $derived(localized(r, 'tagline'));
	const about = $derived(localized(r, 'about'));
	const policies = $derived(localized(r, 'policies'));
	const years = $derived(yearsIn(r.foundedYear));
	const chat = $derived(
		chatHref(
			{ whatsapp: r.whatsapp ?? '', telegram: r.telegram ?? '' },
			m.renter_chat_text({ name })
		)
	);
	const call = $derived(telHref(r.phone));
	const path = (to: string) => resolve(localizeHref(to) as AppPath);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external chat and phone links -->
<svelte:head>
	<title>{m.renter_meta_title({ name })}</title>
	<meta name="description" content={tagline || m.renter_meta_description({ name })} />
	<meta property="og:title" content={m.renter_meta_title({ name })} />
	<meta property="og:description" content={tagline || m.renter_meta_description({ name })} />
	{#if r.coverFile}
		<meta property="og:image" content={`${page.url.origin}${publicFileUrl(r.coverFile)}`} />
	{/if}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pt-12 sm:pb-28">
	<a
		href={path('/renters')}
		class="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft
			class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
			aria-hidden="true"
		/>
		{m.renter_back()}
	</a>

	<header class="mt-6 overflow-hidden rounded-[1.75rem] border border-border bg-card">
		<div class="relative h-40 bg-secondary sm:h-56">
			{#if r.coverFile}
				<img
					src={publicFileUrl(r.coverFile)}
					alt=""
					width="1500"
					height="500"
					fetchpriority="high"
					class="h-full w-full object-cover"
				/>
			{/if}
		</div>
		<div class="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
			<div
				class="-mt-16 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-secondary shadow-md sm:-mt-20 sm:h-28 sm:w-28"
			>
				{#if r.logoFile}
					<img
						src={publicFileUrl(r.logoFile)}
						alt=""
						width="200"
						height="200"
						class="h-full w-full object-cover"
					/>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="display text-3xl leading-tight font-bold sm:text-4xl">{name}</h1>
					<VerifiedBadge />
				</div>
				{#if tagline}<p class="mt-2 text-muted-foreground">{tagline}</p>{/if}
				<ul class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
					{#if r.area}
						<li class="flex items-center gap-1.5">
							<MapPin class="h-4 w-4" aria-hidden="true" />{r.area}
						</li>
					{/if}
					{#if r.offersDelivery}
						<li class="flex items-center gap-1.5">
							<Truck class="h-4 w-4" aria-hidden="true" />{m.rent_delivers()}
						</li>
					{/if}
					{#if r.offersSetup}
						<li class="flex items-center gap-1.5">
							<Wrench class="h-4 w-4" aria-hidden="true" />{m.rent_sets_up()}
						</li>
					{/if}
				</ul>
			</div>
			<div class="flex flex-wrap gap-3">
				{#if chat}
					<a
						href={chat}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex h-12 items-center rounded-full bg-[var(--am-ribbon)] px-6 text-sm font-semibold text-white"
					>
						{m.renter_chat()}
					</a>
				{/if}
				{#if call}
					<a
						href={call}
						class="inline-flex h-12 items-center gap-2 rounded-full border border-foreground/30 px-6 text-sm font-semibold"
					>
						<Phone class="h-4 w-4" aria-hidden="true" />{m.spaces_call()}
					</a>
				{/if}
			</div>
		</div>
		<dl class="grid grid-cols-3 border-t border-border text-center">
			<div class="p-4">
				<dd class="display text-2xl font-bold tabular-nums">{r.listingCount}</dd>
				<dt class="text-xs text-muted-foreground">{m.market_stat_rentals()}</dt>
			</div>
			<div class="border-x border-border p-4">
				<dd class="display text-2xl font-bold tabular-nums">{r.completedCount}</dd>
				<dt class="text-xs text-muted-foreground">{m.market_stat_completed()}</dt>
			</div>
			<div class="p-4">
				<dd class="display text-2xl font-bold tabular-nums">{years ?? '—'}</dd>
				<dt class="text-xs text-muted-foreground">{m.market_stat_years()}</dt>
			</div>
		</dl>
	</header>

	<section class="mt-16" aria-labelledby="renter-rentals">
		<h2 id="renter-rentals" use:reveal class="display text-3xl font-bold sm:text-4xl">
			{m.renter_rentals({ name })}
		</h2>
		{#if data.listings.length}
			<ul class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.listings as listing, index (listing.id)}
					<li><ListingCard {listing} showRenter={false} eager={index < 3} /></li>
				{/each}
			</ul>
		{:else}
			<p class="mt-6 text-muted-foreground">{m.renter_no_rentals()}</p>
		{/if}
	</section>

	{#if about || policies}
		<section class="mt-20 grid gap-12 lg:grid-cols-2">
			{#if about}
				<div use:reveal>
					<h2 class="display text-3xl font-bold">{m.renter_about({ name })}</h2>
					<p class="mt-5 max-w-[60ch] whitespace-pre-line text-muted-foreground">{about}</p>
				</div>
			{/if}
			{#if policies}
				<div use:reveal>
					<h2 class="display text-3xl font-bold">{m.rent_policies()}</h2>
					<p class="mt-5 max-w-[60ch] whitespace-pre-line text-muted-foreground">{policies}</p>
				</div>
			{/if}
		</section>
	{/if}

	<section id="ask" class="mt-20 scroll-mt-24" aria-labelledby="renter-ask">
		<h2 id="renter-ask" class="display text-3xl font-bold sm:text-4xl">{m.renter_custom()}</h2>
		<p class="mt-3 max-w-[56ch] text-muted-foreground">{m.renter_custom_lede({ name })}</p>
		<div class="mt-8 max-w-2xl"><RentalOrderForm data={data.askForm} kind="ask" /></div>
	</section>
</div>
