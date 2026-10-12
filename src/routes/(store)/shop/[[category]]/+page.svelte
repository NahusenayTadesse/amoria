<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate, pushState, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { parseCart } from '$lib/share';
	import { Bag, setBag } from '$lib/components/store/bag.svelte';
	import ProductCard from '$lib/components/store/ProductCard.svelte';
	import ProductSheet from '$lib/components/store/ProductSheet.svelte';
	import CheckoutSheet from '$lib/components/store/CheckoutSheet.svelte';
	import ShopFilters from '$lib/components/store/ShopFilters.svelte';
	import * as Sheet from '@nahu/admin-kit/components/ui/sheet/index.js';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { get, writable, type Writable } from 'svelte/store';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { birr, localized } from '$lib/localized';
	import {
		activeCount,
		applyFilter,
		EMPTY_FILTER,
		facetCounts,
		fromFields,
		priceBounds,
		readFilter,
		SHOP_SORTS,
		syncPrice,
		toFields,
		writeFilter,
		type FilterFields,
		type ShopFilter
	} from '$lib/shopFilter';

	let { data } = $props();

	const bag = new Bag(() => data.products);
	setBag(bag);

	let checkoutOpen = $state(false);

	/** The product whose sheet is open: shallow-routing state, so Back closes it. */
	const opened = $derived(
		page.state.sheet === 'product'
			? data.products.find((p) => p.key === page.state.productKey)
			: undefined
	);

	/** Category ids and slugs both ways: the URL names categories, the checklist holds ids. */
	const idOfSlug = (slug: string) => data.categories.find((c) => c.slug === slug)?.id;
	const slugOfId = (id: number) => data.categories.find((c) => c.id === id)?.slug;

	/**
	 * The filter as the URL gives it. `/shop/flowers` (an older link, or a search result) starts
	 * with that category ticked; after that, categories live in `?cat=` with the other choices.
	 */
	function filterOfUrl(): ShopFilter {
		const filter = readFilter(page.url.searchParams);
		const routeSlug = data.categories.find((c) => c.id === data.activeCategoryId)?.slug;
		if (routeSlug && !page.url.searchParams.has('cat')) filter.cats = [routeSlug];
		return filter;
	}

	/** The sidebar's kit fields, read from the URL (so the server renders the same list). */
	const fields = writable<FilterFields>(toFields(filterOfUrl(), idOfSlug));
	const noErrors = writable<Record<string, unknown>>({});
	let filtersOpen = $state(false);

	const filter = $derived(fromFields($fields, slugOfId));

	/** Every change goes into the URL, so a reload or a shared link shows the same list. */
	let written = writeFilter(fromFields(get(fields), slugOfId));
	let routerReady = false;
	// A snapshot, not the store's object: kit fields change that object in place.
	let before = { ...get(fields) };
	const stopSync = fields.subscribe((next) => {
		const synced = syncPrice(before, next);
		before = { ...synced };
		if (synced !== next) {
			fields.set(synced);
			return;
		}
		const query = writeFilter(fromFields(synced, slugOfId));
		if (!routerReady || query === written) return;
		written = query;
		const rest = new URLSearchParams(page.url.searchParams);
		replaceState(
			resolve(
				`${localizeHref('/shop')}${writeFilter(fromFields(synced, slugOfId), rest)}` as AppPath
			),
			page.state
		);
	});

	onDestroy(stopSync);

	function change(patch: Partial<FilterFields>) {
		fields.update((current) => ({ ...current, ...patch }));
	}

	const categoryIds = $derived(filter.cats.flatMap((slug) => idOfSlug(slug) ?? []));
	const shown = $derived(applyFilter(data.products, filter, categoryIds));
	const facets = $derived(facetCounts(data.products, filter, categoryIds));
	const bounds = $derived(priceBounds(data.products));
	const narrowing = $derived(activeCount(filter));
	/** Categories with something on the shop (a category of containers alone has nothing to show). */
	const shopCategories = $derived(
		data.categories.filter(
			(c) => categoryIds.includes(c.id) || data.products.some((p) => p.categoryId === c.id)
		)
	);

	/** Boxes customers fill: the banner on top and the sidebar's link lead to the builder. */
	const boxes = $derived(data.products.filter((product) => product.bundle?.custom));
	const bestSaving = $derived(Math.max(0, ...boxes.map((box) => box.bundle?.discountPercent ?? 0)));
	const buildHref = $derived(boxes.length ? localizeHref('/shop/build') : null);

	const sortItems = $derived(
		SHOP_SORTS.map(
			(sort) =>
				({
					featured: { value: sort, name: m.shop_sort_featured() },
					newest: { value: sort, name: m.shop_sort_newest() },
					price_asc: { value: sort, name: m.shop_sort_price_asc() },
					price_desc: { value: sort, name: m.shop_sort_price_desc() },
					name: { value: sort, name: m.shop_sort_name() }
				})[sort]
		)
	);
	const typeLabels = {
		gift: m.shop_type_gift,
		bundle: m.shop_type_bundle,
		custom: m.shop_type_custom
	};

	/** The choices in force, each removable on its own. */
	const chips = $derived([
		...(filter.q.trim() ? [{ key: 'q', label: `“${filter.q.trim()}”`, clear: { q: '' } }] : []),
		...filter.types.map((type) => ({
			key: `t-${type}`,
			label: typeLabels[type](),
			clear: { types: $fields.types.filter((t) => t !== type) }
		})),
		...categoryIds.map((id) => {
			const category = data.categories.find((c) => c.id === id)!;
			return {
				key: `c-${id}`,
				label: localized(category, 'name'),
				clear: { cats: $fields.cats.filter((c) => Number(c) !== id) }
			};
		}),
		...(filter.min !== null || filter.max !== null
			? [
					{
						key: 'price',
						label:
							filter.min !== null && filter.max !== null
								? `${birr(filter.min)} – ${birr(filter.max)}`
								: filter.min !== null
									? m.shop_price_over({ min: birr(filter.min) })
									: m.shop_price_under({ max: birr(filter.max) }),
						clear: { min: null, max: null, price: '' }
					}
				]
			: []),
		...(filter.inStock
			? [{ key: 'stock', label: m.shop_in_stock(), clear: { inStock: false } }]
			: []),
		...(filter.onSale ? [{ key: 'sale', label: m.shop_on_sale(), clear: { onSale: false } }] : [])
	] as { key: string; label: string; clear: Partial<FilterFields> }[]);

	const clearAll = () => fields.set({ ...toFields(EMPTY_FILTER, idOfSlug), sort: $fields.sort });

	/**
	 * Links that act on the shop: `?bag=1` (the tab bar's Bag tab), `?add=`, `?cart=` and
	 * `?product=`. Handled after each navigation rather than on mount or in an effect, once the bag
	 * has been read back from storage, so "open checkout if there is anything in it" sees what is
	 * there.
	 * Tapping the Bag tab while already on the shop is a navigation too, so it lands here as well.
	 */
	let restored = false;
	// On a fresh load SvelteKit calls this just before it marks the router started, and in dev
	// `replaceState` throws until then; one microtask later it is.
	afterNavigate(() => queueMicrotask(handleLinks));

	function handleLinks() {
		if (!restored) {
			bag.restore();
			restored = true;
		}
		// Back, or a link to the shop with choices in it, brings its own choices with them.
		const fromUrl = filterOfUrl();
		written = writeFilter(fromUrl);
		routerReady = true;
		if (writeFilter(fromFields(get(fields), slugOfId)) !== written) {
			fields.set(toFields(fromUrl, idOfSlug));
		}

		const cleaned = (...drop: string[]) => {
			// The other params, kept as they were.
			const rest = [...page.url.searchParams].filter(([key]) => !drop.includes(key));
			const query = rest.length
				? `?${rest.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
				: '';
			replaceState(resolve(`${page.url.pathname}${query}` as AppPath), page.state);
		};

		if (page.url.searchParams.has('bag')) {
			if (bag.count > 0) checkoutOpen = true;
			cleaned('bag');
		}

		// `/buy/[slug]` lands here with `?add=` (§10): the gift goes in the bag and checkout opens.
		const slug = page.url.searchParams.get('add');
		if (slug) {
			const product = data.products.find((p) => p.slug === slug);
			cleaned('add');
			// A box the customer builds is filled first: its builder opens instead of checkout.
			if (product?.bundle?.custom) {
				pushState('', { sheet: 'product', productKey: product.key });
			} else {
				if (product && product.stockQty > 0 && bag.qtyOf(product.key) === 0) bag.add(product);
				if (bag.count > 0) checkoutOpen = true;
			}
		}

		// A shared bag, `?cart=slug.qty,…`: its gifts go in this bag, and checkout opens.
		const shared = page.url.searchParams.get('cart');
		if (shared) {
			for (const { slug, qty } of parseCart(shared)) {
				const product = data.products.find((p) => p.slug === slug);
				if (product && product.stockQty > 0) bag.set(product, qty);
			}
			if (bag.count > 0) checkoutOpen = true;
			cleaned('cart');
		}

		// A shared product link, `?product=slug`: that gift's sheet opens.
		const wanted = page.url.searchParams.get('product');
		if (wanted) {
			const product = data.products.find((p) => p.slug === wanted);
			cleaned('product');
			if (product) pushState('', { sheet: 'product', productKey: product.key });
		}
	}
</script>

<svelte:head>
	<title>{m.shop_meta_title()}</title>
	<meta name="description" content={m.shop_meta_description()} />
	<meta property="og:title" content={m.shop_meta_title()} />
	<meta property="og:description" content={m.shop_meta_description()} />
</svelte:head>

<div class="mx-auto max-w-7xl px-4 pt-8 pb-32 sm:px-8 sm:pt-14">
	<header class="max-w-2xl">
		<h1 class="display text-[2.1rem] leading-[1.05] font-bold text-foreground sm:text-6xl">
			{m.shop_heading()}
		</h1>
		<p class="mt-4 max-w-[52ch] text-base text-muted-foreground sm:text-lg">{m.shop_intro()}</p>
	</header>

	{#if boxes.length && buildHref}
		<a
			href={resolve(buildHref as AppPath)}
			class="build group mt-8 grid overflow-hidden rounded-[1.5rem] bg-[var(--am-ink)] text-white sm:grid-cols-[1fr_minmax(0,20rem)] lg:mt-10"
		>
			<div class="flex flex-col justify-center gap-2 p-6 sm:px-8 sm:py-7">
				<p class="text-xs font-semibold tracking-[0.2em] text-[var(--am-foil)] uppercase">
					{m.build_banner_kicker()}
				</p>
				<h2 class="display text-2xl leading-tight font-bold sm:text-3xl">
					{m.build_banner_title()}
				</h2>
				<p class="max-w-[46ch] text-white/80">{m.build_banner_text({ percent: bestSaving })}</p>
				<span
					class="mt-3 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[var(--am-ink)] transition-transform group-hover:translate-x-1"
				>
					{m.build_banner_cta()}
					<ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</div>
			{#if boxes[0].image}
				<img
					src={publicFileUrl(boxes[0].image)}
					alt=""
					width="700"
					height="500"
					loading="eager"
					decoding="async"
					class="h-40 w-full object-cover sm:h-full sm:max-h-64"
				/>
			{/if}
		</a>
	{/if}

	<div class="mt-8 sm:mt-10 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
		<aside class="hidden lg:block" aria-label={m.shop_filters()}>
			<div class="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-3 pb-6">
				<ShopFilters
					form={fields}
					errors={noErrors}
					{facets}
					categories={shopCategories}
					{bounds}
					{buildHref}
					idPrefix="side"
				/>
			</div>
		</aside>

		<div>
			<div
				class="toolbar sticky z-20 -mx-4 flex items-center gap-3 bg-background/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:px-0"
			>
				<button
					type="button"
					onclick={() => (filtersOpen = true)}
					class="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold lg:hidden"
				>
					<SlidersHorizontal class="h-4 w-4" aria-hidden="true" />
					{narrowing ? m.shop_filters_count({ count: narrowing }) : m.shop_filters()}
				</button>
				<p class="hidden text-sm text-muted-foreground lg:block" aria-live="polite">
					{m.shop_results({ count: shown.length })}
				</p>
				<div class="ml-auto w-56">
					<InputComp
						form={fields as unknown as Writable<Record<string, unknown>>}
						errors={noErrors}
						name="sort"
						id="shop-sort"
						type="select"
						label={m.shop_sort()}
						items={sortItems}
						hideLabel
					/>
				</div>
			</div>

			{#if chips.length}
				<ul class="mt-3 flex flex-wrap items-center gap-2">
					{#each chips as chip (chip.key)}
						<li>
							<button
								type="button"
								onclick={() => change(chip.clear)}
								aria-label={m.shop_remove_filter({ label: chip.label })}
								class="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary pr-2.5 pl-3.5 text-sm"
							>
								{chip.label}
								<X class="h-3.5 w-3.5" aria-hidden="true" />
							</button>
						</li>
					{/each}
					<li>
						<button
							type="button"
							onclick={clearAll}
							class="h-9 px-2 text-sm font-semibold underline underline-offset-4"
						>
							{m.shop_clear()}
						</button>
					</li>
				</ul>
			{/if}

			<section class="mt-6" aria-live="polite">
				<p class="sr-only lg:hidden">{m.shop_results({ count: shown.length })}</p>
				{#if shown.length}
					<ul class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6">
						{#each shown as product, index (product.key)}
							<li>
								<ProductCard
									{product}
									eager={index < 4}
									onopen={() => pushState('', { sheet: 'product', productKey: product.key })}
								/>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="max-w-md rounded-[var(--radius)] bg-secondary p-6 text-muted-foreground">
						<p>
							{narrowing
								? m.shop_no_match()
								: data.products.length
									? m.shop_empty_category()
									: m.shop_empty_catalog()}
						</p>
						{#if narrowing}
							<button
								type="button"
								onclick={clearAll}
								class="mt-3 text-sm font-semibold text-foreground underline underline-offset-4"
							>
								{m.shop_clear()}
							</button>
						{/if}
					</div>
				{/if}
			</section>
		</div>
	</div>
</div>

<Sheet.Root bind:open={filtersOpen}>
	<Sheet.Content
		data-site-type
		side="bottom"
		class="store flex max-h-[92dvh] flex-col gap-0 rounded-t-[1.25rem] p-0"
	>
		<Sheet.Header class="border-b border-border px-5 py-4">
			<Sheet.Title class="display text-xl font-bold">{m.shop_filters()}</Sheet.Title>
			<Sheet.Description class="sr-only"
				>{m.shop_results({ count: shown.length })}</Sheet.Description
			>
		</Sheet.Header>
		<div class="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
			<ShopFilters
				form={fields}
				errors={noErrors}
				{facets}
				categories={shopCategories}
				{bounds}
				{buildHref}
				idPrefix="sheet"
			/>
		</div>
		<div
			class="flex items-center gap-3 border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
		>
			<button
				type="button"
				onclick={clearAll}
				disabled={!narrowing}
				class="h-12 flex-1 rounded-full border border-foreground/40 text-sm font-semibold disabled:opacity-40"
			>
				{m.shop_clear()}
			</button>
			<button
				type="button"
				onclick={() => (filtersOpen = false)}
				class="h-12 flex-[2] rounded-full bg-foreground text-sm font-semibold text-background"
			>
				{m.shop_show_results({ count: shown.length })}
			</button>
		</div>
	</Sheet.Content>
</Sheet.Root>

<ProductSheet
	product={opened}
	onclose={() => history.back()}
	onbuy={() => {
		checkoutOpen = true;
		history.back();
	}}
/>

<CheckoutSheet
	bind:open={checkoutOpen}
	data={data.form}
	accounts={data.accounts}
	holdMinutes={data.holdMinutes}
	delivery={data.delivery}
/>

<style>
	/* Stays under the header, which slides away on the way down the page (see SiteHeader). */
	.toolbar {
		top: var(--header-offset, 0px);
		transition: top 0.3s;
	}
</style>
