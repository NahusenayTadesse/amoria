<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';
	import Check from '@lucide/svelte/icons/check';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Package from '@lucide/svelte/icons/package';
	import Truck from '@lucide/svelte/icons/truck';
	import Users from '@lucide/svelte/icons/users';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { setKitLabels } from '@nahu/admin-kit/labels';
	import YouTubeEmbed from '@nahu/admin-kit/components/YouTubeEmbed.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { birr, localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import { priceText } from '$lib/marketText';
	import Gallery from '$lib/components/store/Gallery.svelte';
	import ListingCard from '$lib/components/store/ListingCard.svelte';
	import RenterCard from '$lib/components/store/RenterCard.svelte';
	import RentalOrderForm from '$lib/components/store/RentalOrderForm.svelte';
	import VerifiedBadge from '$lib/components/store/VerifiedBadge.svelte';

	let { data } = $props();

	setKitLabels(() => ({
		youtubePlay: (title) => m.video_play({ title }),
		youtubeWatch: m.video_watch()
	}));

	const listing = $derived(data.listing);
	const renter = $derived(data.renter);
	const name = $derived(localized(listing, 'name'));
	const summary = $derived(localized(listing, 'summary'));
	const description = $derived(localized(listing, 'description'));
	const category = $derived(
		localized({ name: listing.categoryName, nameAm: listing.categoryNameAm }, 'name')
	);
	const renterName = $derived(
		localized({ name: renter.businessName, nameAm: renter.businessNameAm }, 'name')
	);
	const policies = $derived(localized(renter, 'policies'));
	const features = $derived(
		getLocale() === 'am' && listing.featuresAm.length ? listing.featuresAm : listing.features
	);
	const price = $derived(priceText(listing));
	const images = $derived(
		listing.images.map((image) => ({
			id: image.id,
			fileName: image.fileName,
			alt: localized({ alt: image.alt, altAm: image.altAm }, 'alt') || name
		}))
	);
	const cover = $derived(images[0]);
	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	/** "Book now" or "Ask for a quote": one form for both, so switching keeps what was typed. */
	let orderKind = $state<'book' | 'ask'>('book');
	const orderKinds = [
		{ value: 'book', label: m.market_book_now, Icon: CalendarCheck },
		{ value: 'ask', label: m.market_ask_quote, Icon: MessageCircle }
	] as const;

	const metaDescription = $derived(
		summary || m.rent_meta_description({ name, renter: renterName })
	);
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'Product',
			name,
			description: metaDescription,
			category,
			brand: { '@type': 'Organization', name: renterName },
			...(cover ? { image: `${page.url.origin}${publicFileUrl(cover.fileName)}` } : {}),
			...(listing.pricing === 'fixed' && listing.price != null
				? {
						offers: {
							'@type': 'Offer',
							price: listing.price,
							priceCurrency: 'ETB',
							availability: 'https://schema.org/InStock'
						}
					}
				: {})
		}).replace(/</g, '\\u003c')
	);
	const ldTag = $derived(`<script type="application/ld+json">${jsonLd}<${'/'}script>`);
</script>

<svelte:head>
	<title>{m.rent_meta_title({ name })}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content={m.rent_meta_title({ name })} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="product" />
	{#if cover}
		<meta property="og:image" content={`${page.url.origin}${publicFileUrl(cover.fileName)}`} />
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ldTag}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pt-12 sm:pb-28">
	<a
		href={path('/rentals')}
		class="rise group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
		style="--i: 0"
	>
		<ArrowLeft
			class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
			aria-hidden="true"
		/>
		{m.rent_back()}
	</a>

	<div class="mt-6 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
		<div class="rise" style="--i: 1">
			<div class="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-secondary">
				{#if cover}
					<img
						src={publicFileUrl(cover.fileName)}
						alt={cover.alt}
						width="960"
						height="720"
						fetchpriority="high"
						class="absolute inset-0 h-full w-full object-cover"
					/>
				{:else}
					<div class="art absolute inset-0 grid place-items-center" aria-hidden="true">
						<Package class="h-24 w-24 text-white/90" />
					</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-col">
			<p
				class="rise text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase"
				style="--i: 1"
			>
				<a href={path(`/rentals?category=${listing.categorySlug}`)} class="hover:underline"
					>{category}</a
				>
			</p>
			<h1 class="display mt-3 text-4xl leading-[1.05] font-bold sm:text-5xl">
				<span class="line"><span class="line-in" style="--i: 2">{name}</span></span>
			</h1>
			<p class="rise mt-4 flex flex-wrap items-center gap-2 text-sm" style="--i: 3">
				{m.rent_by()}
				<a
					href={path(`/renters/${renter.slug}`)}
					class="font-semibold underline-offset-4 hover:underline">{renterName}</a
				>
				<VerifiedBadge compact />
			</p>
			{#if summary}
				<p class="rise mt-5 max-w-[52ch] text-base text-muted-foreground sm:text-lg" style="--i: 3">
					{summary}
				</p>
			{/if}

			<div class="rise mt-7 flex flex-wrap gap-x-10 gap-y-4" style="--i: 4">
				<div>
					<p class="display text-3xl font-bold tabular-nums">{price.amount}</p>
					{#if price.unit}<p class="text-xs text-muted-foreground">{price.unit}</p>{/if}
					{#if listing.deposit > 0}
						<p class="mt-1 text-xs text-muted-foreground">
							{m.rent_deposit_each({ amount: birr(listing.deposit) })}
						</p>
					{/if}
				</div>
				{#if listing.capacity}
					<p class="flex items-center gap-2 self-center text-base font-semibold">
						<Users class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
						{m.spaces_capacity({ count: listing.capacity })}
					</p>
				{/if}
				{#if listing.quantity > 1}
					<p class="flex items-center gap-2 self-center text-base font-semibold">
						<Package class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
						{m.rent_available({ count: listing.quantity })}
					</p>
				{/if}
			</div>

			{#if listing.deliveryAvailable || listing.setupIncluded}
				<ul class="rise mt-5 flex flex-wrap gap-2" style="--i: 4">
					{#if listing.deliveryAvailable}
						<li
							class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm"
						>
							<Truck class="h-4 w-4" aria-hidden="true" />{m.rent_delivers()}
						</li>
					{/if}
					{#if listing.setupIncluded}
						<li
							class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm"
						>
							<Wrench class="h-4 w-4" aria-hidden="true" />{m.rent_sets_up()}
						</li>
					{/if}
				</ul>
			{/if}

			<a
				href="#order"
				class="rise btn-shine group mt-7 inline-flex h-13 w-fit items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
				style="--i: 5"
			>
				{data.canBook ? m.market_book_now() : m.market_ask_quote()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				/>
			</a>
		</div>
	</div>

	{#if listing.youtubeUrl}
		<section class="mt-20 sm:mt-28" aria-labelledby="rent-video">
			<h2 id="rent-video" use:reveal class="display text-3xl font-bold sm:text-4xl">
				{m.spaces_video()}
			</h2>
			<div use:reveal class="mt-8 max-w-4xl overflow-hidden rounded-[1.5rem]">
				<YouTubeEmbed url={listing.youtubeUrl} title={name} class="rounded-none" />
			</div>
		</section>
	{/if}

	{#if description || features.length}
		<section class="mt-20 grid gap-12 sm:mt-28 lg:grid-cols-2">
			{#if description}
				<div use:reveal>
					<h2 class="display text-3xl font-bold sm:text-4xl">{m.rent_about()}</h2>
					<p
						class="mt-6 max-w-[60ch] text-base whitespace-pre-line text-muted-foreground sm:text-lg"
					>
						{description}
					</p>
				</div>
			{/if}
			{#if features.length}
				<div use:reveal>
					<h2 class="display text-3xl font-bold sm:text-4xl">{m.spaces_features()}</h2>
					<ul class="mt-6 flex flex-col gap-3">
						{#each features as feature, index (index)}
							<li class="flex items-start gap-3 text-base sm:text-lg">
								<span
									class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--am-ribbon)] text-white"
								>
									<Check class="h-4 w-4" aria-hidden="true" />
								</span>
								{feature}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	{#if images.length > 1}
		<section class="mt-20 sm:mt-28" aria-labelledby="rent-gallery">
			<h2 id="rent-gallery" use:reveal class="display text-3xl font-bold sm:text-4xl">
				{m.spaces_gallery()}
			</h2>
			<div class="mt-8">
				<Gallery {images} label={m.spaces_gallery()} />
			</div>
		</section>
	{/if}

	<section
		id="order"
		class="mt-20 grid scroll-mt-24 gap-10 sm:mt-28 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14"
		aria-labelledby="order-heading"
	>
		<div>
			<h2 id="order-heading" class="display text-3xl font-bold sm:text-4xl">
				{data.canBook ? m.rent_order_heading() : m.market_ask_quote()}
			</h2>
			<p class="mt-3 max-w-[56ch] text-muted-foreground">
				{data.canBook ? m.rent_order_lede() : m.rent_ask_lede({ renter: renterName })}
			</p>
			<div class="mt-8 max-w-2xl">
				{#if data.canBook && listing.price != null}
					<div
						role="radiogroup"
						aria-label={m.rent_order_heading()}
						class="mb-6 grid grid-cols-2 gap-3"
					>
						{#each orderKinds as option (option.value)}
							{@const on = orderKind === option.value}
							<button
								type="button"
								role="radio"
								aria-checked={on}
								onclick={() => (orderKind = option.value)}
								class={[
									'inline-flex h-13 items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-300 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
									on
										? 'border-[var(--am-ribbon)] bg-[var(--am-ribbon)] text-white shadow-[0_14px_34px_-18px_var(--am-ribbon)]'
										: 'border-border bg-card text-muted-foreground hover:border-[var(--am-ribbon)]/60 hover:text-foreground'
								]}
							>
								{#if on}
									<Check class="h-4 w-4" aria-hidden="true" />
								{:else}
									<option.Icon class="h-4 w-4" aria-hidden="true" />
								{/if}
								{option.label()}
							</button>
						{/each}
					</div>
					<RentalOrderForm
						data={data.bookForm}
						kind={orderKind}
						priced={orderKind === 'book'
							? {
									price: listing.price,
									unit: listing.priceUnit,
									deposit: listing.deposit,
									quantity: listing.quantity
								}
							: null}
						maxQty={listing.quantity}
						hourly={listing.priceUnit === 'hour'}
					/>
				{:else}
					<RentalOrderForm
						data={data.askForm}
						kind="ask"
						maxQty={listing.quantity}
						hourly={listing.priceUnit === 'hour'}
					/>
				{/if}
			</div>
		</div>
		<aside class="flex flex-col gap-6">
			<RenterCard {renter} />
			{#if policies}
				<div class="rounded-[1.5rem] border border-border bg-card p-5">
					<h3 class="font-semibold">{m.rent_policies()}</h3>
					<p class="mt-2 text-sm whitespace-pre-line text-muted-foreground">{policies}</p>
				</div>
			{/if}
		</aside>
	</section>

	{#if data.more.length}
		<section class="mt-20 sm:mt-28" aria-labelledby="rent-more">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<h2 id="rent-more" use:reveal class="display text-3xl font-bold sm:text-4xl">
					{m.rent_more({ renter: renterName })}
				</h2>
				<a
					href={path(`/renters/${renter.slug}`)}
					class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
				>
					{m.rent_see_all()}
					<ArrowRight class="h-4 w-4" aria-hidden="true" />
				</a>
			</div>
			<ul class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.more as item (item.id)}
					<li><ListingCard listing={item} showRenter={false} /></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.art {
		background:
			radial-gradient(circle at 25% 30%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 78% 72%, #d4a23a, transparent 55%), #1d5b3d;
	}
</style>
