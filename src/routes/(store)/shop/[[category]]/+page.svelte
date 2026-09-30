<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { localized } from '$lib/localized';
	import { Bag, setBag } from '$lib/components/store/bag.svelte';
	import ProductCard from '$lib/components/store/ProductCard.svelte';
	import BagBar from '$lib/components/store/BagBar.svelte';
	import CheckoutSheet from '$lib/components/store/CheckoutSheet.svelte';

	let { data } = $props();

	const bag = new Bag(() => data.products);
	setBag(bag);

	let checkoutOpen = $state(false);

	const shown = $derived(
		data.activeCategoryId === null
			? data.products
			: data.products.filter((product) => product.categoryId === data.activeCategoryId)
	);

	onMount(() => {
		bag.restore();

		// `/buy/[slug]` lands here with `?add=` (§10): the gift goes in the bag and checkout opens.
		const slug = page.url.searchParams.get('add');
		if (slug) {
			const product = data.products.find((p) => p.slug === slug);
			if (product && product.stockQty > 0 && bag.qtyOf(product.id) === 0) bag.add(product);
			if (bag.count > 0) checkoutOpen = true;
			// The other params, kept as they were; only `add` is dropped.
			const rest = [...page.url.searchParams].filter(([key]) => key !== 'add');
			const query = rest.length
				? `?${rest.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
				: '';
			replaceState(resolve(`${page.url.pathname}${query}` as AppPath), page.state);
		}
	});
</script>

<svelte:head>
	<title>{m.shop_meta_title()}</title>
	<meta name="description" content={m.shop_meta_description()} />
	<meta property="og:title" content={m.shop_meta_title()} />
	<meta property="og:description" content={m.shop_meta_description()} />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pt-8 pb-32 sm:px-8 sm:pt-14">
	<header class="max-w-2xl">
		<h1 class="display text-[2.1rem] leading-[1.05] font-bold text-foreground sm:text-6xl">
			{m.shop_heading()}
		</h1>
		<p class="mt-4 max-w-[52ch] text-base text-muted-foreground sm:text-lg">{m.shop_intro()}</p>
	</header>

	{#if data.categories.length > 1}
		<nav
			aria-label={m.shop_filter_label()}
			class="-mx-4 mt-8 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
		>
			<ul class="flex w-max gap-2">
				{#each [{ id: null, slug: '', label: m.shop_filter_all() }, ...data.categories.map( (c) => ({ id: c.id, slug: c.slug, label: localized(c, 'name') }) )] as chip (chip.id ?? 'all')}
					{@const current = chip.id === data.activeCategoryId}
					<li>
						<a
							href={resolve(localizeHref(chip.slug ? `/shop/${chip.slug}` : '/shop') as AppPath)}
							aria-current={current ? 'page' : undefined}
							data-sveltekit-noscroll
							class={[
								'inline-flex h-10 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors',
								current
									? 'border-foreground bg-foreground font-semibold text-background'
									: 'border-border bg-card text-foreground hover:border-foreground/50'
							]}
						>
							{chip.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<section class="mt-8 sm:mt-10" aria-live="polite">
		{#if shown.length}
			<ul class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
				{#each shown as product, index (product.id)}
					<li>
						<ProductCard {product} eager={index < 4} onbuy={() => (checkoutOpen = true)} />
					</li>
				{/each}
			</ul>
		{:else}
			<p class="max-w-md rounded-[var(--radius)] bg-secondary p-6 text-muted-foreground">
				{data.products.length ? m.shop_empty_category() : m.shop_empty_catalog()}
			</p>
		{/if}
	</section>
</div>

<BagBar onopen={() => (checkoutOpen = true)} />

<CheckoutSheet
	bind:open={checkoutOpen}
	data={data.form}
	accounts={data.accounts}
	holdMinutes={data.holdMinutes}
	delivery={data.delivery}
/>
