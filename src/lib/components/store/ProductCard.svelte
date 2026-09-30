<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, localized } from '$lib/localized';
	import { getBag } from './bag.svelte';

	type Props = {
		product: {
			id: number;
			name: string;
			nameAm: string | null;
			price: number;
			stockQty: number;
			isFeatured: boolean;
			image: string | null;
			imageAlt: string | null;
		};
		/** Below this many, the card says how many are left. */
		fewLeftAt?: number;
		/** Eager-load the first row's images; lazy-load the rest (§13). */
		eager?: boolean;
		/** Opens checkout. "Buy now" calls it after putting the gift in the bag. */
		onbuy: () => void;
	};

	let { product, fewLeftAt = 3, eager = false, onbuy }: Props = $props();

	const bag = getBag();
	const name = $derived(localized(product, 'name'));
	const inBag = $derived(bag.qtyOf(product.id));
	const soldOut = $derived(product.stockQty <= 0);
	const atMax = $derived(inBag >= bag.maxFor(product));

	/** One tap from the grid to checkout: in the bag (once, not again), then the sheet. */
	function buyNow() {
		if (inBag === 0) bag.add(product);
		onbuy();
	}
</script>

<article class="group flex flex-col">
	<div class="relative aspect-square overflow-hidden rounded-[var(--radius)] bg-secondary">
		{#if product.image}
			<img
				src={publicFileUrl(product.image)}
				alt={product.imageAlt ?? name}
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="600"
				height="600"
				class={['h-full w-full object-cover', soldOut && 'opacity-50 grayscale']}
			/>
		{:else}
			<!-- A wrapped box: the ribbon crosses where the photo will go. -->
			<div class="wrapped absolute inset-0" aria-hidden="true"></div>
		{/if}

		{#if soldOut}
			<span
				class="absolute top-2 left-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background"
			>
				{m.product_sold_out()}
			</span>
		{:else if product.isFeatured}
			<span
				class="absolute top-2 left-2 rounded-full bg-[var(--am-foil)] px-2.5 py-1 text-xs font-semibold text-white"
			>
				{m.product_featured()}
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1 pt-3">
		<h3 class="text-[0.95rem] leading-snug font-medium text-foreground">{name}</h3>
		<p class="text-[0.95rem] font-semibold text-foreground tabular-nums">{birr(product.price)}</p>
		{#if !soldOut && product.stockQty <= fewLeftAt}
			<p class="text-xs font-medium text-[var(--am-ribbon)]">
				{m.product_few_left({ count: product.stockQty })}
			</p>
		{/if}
	</div>

	<div class="flex flex-col gap-2 pt-3">
		{#if !soldOut}
			<button
				type="button"
				onclick={buyNow}
				aria-label={m.product_buy_now_label({ name })}
				class="h-11 w-full rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
			>
				{m.product_buy_now()}
			</button>
		{/if}
		{#if soldOut}
			<!-- Nothing to press; the badge on the photo says why. -->
		{:else if inBag === 0}
			<button
				type="button"
				onclick={() => bag.add(product)}
				class="h-11 w-full rounded-full border border-foreground/40 px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground"
			>
				{m.product_add()}
			</button>
		{:else}
			<div
				class="flex h-11 items-center justify-between rounded-full border border-foreground/40 text-foreground"
				role="group"
				aria-label={m.product_in_bag({ count: inBag })}
			>
				<button
					type="button"
					onclick={() => bag.set(product, inBag - 1)}
					aria-label={m.product_decrease({ name })}
					class="grid h-11 w-11 place-items-center rounded-full hover:bg-secondary"
				>
					<Minus class="h-4 w-4" />
				</button>
				<span class="text-sm font-semibold tabular-nums" aria-live="polite">{inBag}</span>
				<button
					type="button"
					onclick={() => bag.add(product)}
					disabled={atMax}
					aria-label={m.product_increase({ name })}
					class="grid h-11 w-11 place-items-center rounded-full hover:bg-secondary disabled:opacity-40"
				>
					<Plus class="h-4 w-4" />
				</button>
			</div>
		{/if}
	</div>
</article>

<style>
	/* Tissue paper with a ribbon tied across it, drawn with two gradients. */
	.wrapped {
		background:
			linear-gradient(
				90deg,
				transparent 44%,
				color-mix(in oklab, var(--am-ribbon) 22%, transparent) 44% 56%,
				transparent 56%
			),
			linear-gradient(
				0deg,
				transparent 44%,
				color-mix(in oklab, var(--am-ribbon) 22%, transparent) 44% 56%,
				transparent 56%
			),
			var(--secondary);
	}
</style>
