<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import HiddenField from '@nahu/admin-kit/formComponents/HiddenField.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import PhotoArt from '$lib/components/store/PhotoArt.svelte';
	import ListingCard from '$lib/components/store/ListingCard.svelte';
	import JoinRentersBanner from '$lib/components/store/JoinRentersBanner.svelte';

	let { data } = $props();

	const path = (to: string) => resolve(localizeHref(to) as AppPath);
	const f = $derived(data.filters);

	/** The current filters with one changed, as a link: every filter is in the URL. */
	function withFilter(changes: Record<string, string | null>) {
		const values = Object.fromEntries(page.url.searchParams);
		for (const [key, value] of Object.entries(changes)) {
			if (value) values[key] = value;
			else delete values[key];
		}
		if (!('page' in changes)) delete values.page;
		return `${path('/rentals')}${toQuery(values)}`;
	}

	/** `?a=1&b=2` from the set values, or nothing. */
	function toQuery(values: Record<string, string>) {
		const pairs = Object.entries(values).filter(([, value]) => value !== '');
		return pairs.length
			? `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
			: '';
	}

	/** The filter fields (kit components bind a store), refreshed whenever the page's filters change. */
	const fieldsOf = () => ({
		q: f.q ?? '',
		renter: f.renter ?? '',
		pricing: f.pricing ?? '',
		sort: f.sort,
		delivery: f.delivery
	});
	const fields = writable<Record<string, unknown>>(fieldsOf());
	const noErrors = writable<Record<string, unknown>>({});
	$effect(() => fields.set(fieldsOf()));

	/** A choice changed (not the search, which waits for Apply): go there at once. */
	const stop = fields.subscribe((next) => {
		if (!browser) return;
		const changed = (['renter', 'pricing', 'sort'] as const).some(
			(key) => String(next[key] ?? '') !== String(fieldsOf()[key] ?? '')
		);
		if (changed || Boolean(next.delivery) !== f.delivery) void go(next);
	});
	onDestroy(stop);

	function go(values: Record<string, unknown>) {
		const query: Record<string, string> = {};
		if (f.category) query.category = f.category;
		for (const key of ['q', 'renter', 'pricing']) query[key] = String(values[key] ?? '').trim();
		if (values.sort && values.sort !== 'featured') query.sort = String(values.sort);
		if (values.delivery) query.delivery = '1';
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- built from `path()`
		return goto(`${path('/rentals')}${toQuery(query)}`, { keepFocus: true, noScroll: true });
	}

	const active = $derived(
		Boolean(f.category || f.renter || f.pricing || f.delivery || f.q || f.sort !== 'featured')
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- filter links are built from `path()` -->
<svelte:head>
	<title>{m.market_meta_title()}</title>
	<meta name="description" content={m.market_meta_description()} />
	<meta property="og:title" content={m.market_meta_title()} />
	<meta property="og:description" content={m.market_meta_description()} />
	<meta property="og:type" content="website" />
</svelte:head>

<PageHero
	kicker={m.market_kicker()}
	before={m.market_h1_a()}
	accent={m.market_h1_b()}
	after={m.market_h1_c()}
	lede={m.market_lede()}
>
	{#snippet actions()}
		<a
			href="#rentals"
			class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
		>
			{m.market_browse()}
			<ArrowRight
				class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
				aria-hidden="true"
			/>
		</a>
		<a
			href={path('/renters')}
			class="inline-flex h-13 items-center gap-2 rounded-full border border-foreground/30 px-7 text-[0.95rem] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground"
		>
			{m.market_meet_renters()}
		</a>
	{/snippet}
	{#snippet art()}
		<PhotoArt
			main={{ src: '/images/demo/gallery-evening-hall.webp', w: 900, h: 600, small: 480 }}
			side={{ src: '/images/demo/gallery-gold-letters.webp', w: 900, h: 1350, small: 480 }}
		/>
	{/snippet}
</PageHero>

<section id="rentals" class="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-8 sm:pb-28">
	<!-- Categories as chips: the quickest filter on a phone. -->
	{#if data.facets.categories.length}
		<nav aria-label={m.market_categories()} class="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
			<ul class="flex w-max gap-2 sm:w-auto sm:flex-wrap">
				<li>
					<a
						href={withFilter({ category: null })}
						class={[
							'inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors',
							!f.category ? 'bg-foreground text-background' : 'bg-secondary hover:bg-secondary/70'
						]}
						aria-current={!f.category ? 'page' : undefined}
					>
						{m.market_all()}
					</a>
				</li>
				{#each data.facets.categories as c (c.slug)}
					<li>
						<a
							href={withFilter({ category: c.slug })}
							class={[
								'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
								f.category === c.slug
									? 'bg-foreground text-background'
									: 'bg-secondary hover:bg-secondary/70'
							]}
							aria-current={f.category === c.slug ? 'page' : undefined}
						>
							{localized(c, 'name')}
							<span class="text-xs opacity-60">{c.count}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<form
		method="GET"
		action={path('/rentals')}
		class="mt-5 grid gap-3 rounded-[1.5rem] bg-secondary/60 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]"
	>
		{#if f.category}<HiddenField name="category" value={f.category} />{/if}
		<div class="relative sm:col-span-2 lg:col-span-1">
			<InputComp
				form={fields}
				errors={noErrors}
				name="q"
				type="search"
				label={m.market_search()}
				placeholder={m.market_search_placeholder()}
				hideLabel
			/>
		</div>
		<InputComp
			form={fields}
			errors={noErrors}
			name="renter"
			type="select"
			label={m.market_filter_renter()}
			items={[
				{ value: '', name: m.market_any_renter() },
				...data.facets.renters.map((r) => ({
					value: r.slug,
					name: `${localized(r, 'name')} (${r.count})`
				}))
			]}
			hideLabel
		/>
		<InputComp
			form={fields}
			errors={noErrors}
			name="pricing"
			type="select"
			label={m.market_filter_pricing()}
			items={[
				{ value: '', name: m.market_any_pricing() },
				{ value: 'fixed', name: m.market_pricing_fixed() },
				{ value: 'quote', name: m.market_pricing_quote() }
			]}
			hideLabel
		/>
		<InputComp
			form={fields}
			errors={noErrors}
			name="sort"
			type="select"
			label={m.market_sort()}
			items={[
				{ value: 'featured', name: m.market_sort_featured() },
				{ value: 'new', name: m.market_sort_new() },
				{ value: 'price_asc', name: m.market_sort_price_asc() },
				{ value: 'price_desc', name: m.market_sort_price_desc() }
			]}
			hideLabel
		/>
		<div class="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
			<div>
				<InputComp
					form={fields}
					errors={noErrors}
					name="delivery"
					type="checkboxSingle"
					label={m.market_filter_delivery()}
					placeholder={m.market_filter_delivery()}
					hideLabel
				/>
			</div>
			<button
				type="submit"
				class="ms-auto inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
			>
				<SlidersHorizontal class="h-4 w-4" aria-hidden="true" />
				{m.market_apply()}
			</button>
			{#if active}
				<a
					href={path('/rentals')}
					class="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
				>
					<X class="h-4 w-4" aria-hidden="true" />
					{m.market_clear()}
				</a>
			{/if}
		</div>
	</form>

	<p class="mt-6 text-sm text-muted-foreground" aria-live="polite">
		{m.market_count({ count: data.total })}
	</p>

	{#if data.listings.length}
		<ul class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.listings as listing, index (listing.id)}
				<li use:reveal style="--i: {index % 3}">
					<ListingCard {listing} eager={index < 3} />
				</li>
			{/each}
		</ul>
	{:else}
		<div class="mt-6 max-w-xl rounded-[1.5rem] bg-secondary p-7 sm:p-9">
			<p class="display text-xl font-bold sm:text-2xl">
				{active ? m.market_none_filtered() : m.market_empty()}
			</p>
			{#if active}
				<a
					href={path('/rentals')}
					class="mt-4 inline-flex h-11 items-center text-sm font-semibold text-[var(--am-ribbon)] hover:underline"
				>
					{m.market_clear()}
				</a>
			{/if}
		</div>
	{/if}

	{#if data.pages > 1}
		<nav
			aria-label={m.market_pages()}
			class="mt-10 flex flex-wrap items-center justify-center gap-2"
		>
			{#each Array.from({ length: data.pages }, (_, i) => i + 1) as n (n)}
				<a
					href={withFilter({ page: n === 1 ? null : String(n) })}
					class={[
						'grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-semibold',
						n === f.page ? 'bg-foreground text-background' : 'bg-secondary hover:bg-secondary/70'
					]}
					aria-current={n === f.page ? 'page' : undefined}
				>
					{n}
				</a>
			{/each}
		</nav>
	{/if}

	<div class="mt-20"><JoinRentersBanner /></div>
</section>
