<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Link from '@lucide/svelte/icons/link';
	import Zap from '@lucide/svelte/icons/zap';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, localized } from '$lib/localized';
	import { buzz } from '$lib/haptics';
	import { flyToBag } from '$lib/flyToBag';
	import { buyLink, productLink, shareLink } from '$lib/share';
	import { getBag } from './bag.svelte';
	import type { BoxOffer } from '$lib/bundle';

	type Props = {
		product: {
			kind: 'product' | 'bundle';
			id: number;
			key: string;
			slug: string;
			name: string;
			nameAm: string | null;
			price: number;
			stockQty: number;
			isFeatured: boolean;
			image: string | null;
			imageAlt: string | null;
			/** A bundle: what its gifts cost one by one, and the discount off that. */
			bundle?: {
				items: unknown[];
				fullPrice: number;
				discountPercent: number;
				/** Set for a box the customer fills: + opens the builder instead. */
				custom?: BoxOffer | null;
			} | null;
		};
		/** Below this many, the card says how many are left. */
		fewLeftAt?: number;
		/** Eager-load the first row's images; lazy-load the rest (§13). */
		eager?: boolean;
		/** Opens the product's sheet: tapping the photo or the name. */
		onopen: () => void;
	};

	let { product, fewLeftAt = 3, eager = false, onopen }: Props = $props();

	const bag = getBag();
	const name = $derived(localized(product, 'name'));
	const inBag = $derived(bag.qtyOf(product.key));
	const soldOut = $derived(product.stockQty <= 0);
	const atMax = $derived(inBag >= bag.maxFor(product));

	let photo = $state<HTMLElement>();

	/** A box the customer builds is filled in its sheet; it cannot go in the bag empty. */
	const isBox = $derived(Boolean(product.bundle?.custom));

	function add() {
		if (isBox) {
			onopen();
			return;
		}
		bag.add(product);
		buzz();
		flyToBag(photo, product.image ? publicFileUrl(product.image) : null);
	}

	/** Phones: the share button opens the two options with a tap. Mouse: hovering the card does. */
	let shareOpen = $state(false);
	let shareBox = $state<HTMLElement>();

	function share(kind: 'page' | 'buy') {
		shareOpen = false;
		void shareLink({
			title: name,
			text: `${name}: ${birr(product.price)}`,
			url: kind === 'page' ? productLink(product.slug) : buyLink(product.slug)
		});
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (shareOpen && !shareBox?.contains(event.target as Node)) shareOpen = false;
	}}
/>

<article class="group flex flex-col">
	<div
		bind:this={photo}
		class="relative aspect-square overflow-hidden rounded-[var(--radius)] bg-secondary"
	>
		<button
			type="button"
			onclick={onopen}
			aria-label={m.product_open_label({ name })}
			class="absolute inset-0 block h-full w-full active:opacity-90"
		>
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
		</button>

		{#if soldOut}
			<span
				class="pointer-events-none absolute top-2 left-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background"
			>
				{m.product_sold_out()}
			</span>
		{:else if product.isFeatured}
			<span
				class="pointer-events-none absolute top-2 left-2 rounded-full bg-[var(--am-foil)] px-2.5 py-1 text-xs font-semibold text-white"
			>
				{m.product_featured()}
			</span>
		{/if}

		<div bind:this={shareBox} class="absolute top-2 right-2 flex flex-col items-end gap-2">
			<button
				type="button"
				onclick={() => (shareOpen = !shareOpen)}
				aria-label={m.share_toggle({ name })}
				aria-expanded={shareOpen}
				class="grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur pointer-fine:hidden"
			>
				<Share2 class="h-4 w-4" aria-hidden="true" />
			</button>
			<div
				class={[
					'flex flex-col gap-2 transition-opacity',
					shareOpen
						? 'opacity-100'
						: 'pointer-events-none opacity-0 pointer-fine:pointer-events-auto',
					'pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100'
				]}
			>
				<button
					type="button"
					onclick={() => share('page')}
					aria-label={m.share_product_link({ name })}
					title={m.share_product_link({ name })}
					class="grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur active:scale-90"
				>
					<Link class="h-4 w-4" aria-hidden="true" />
				</button>
				{#if !soldOut}
					<button
						type="button"
						onclick={() => share('buy')}
						aria-label={m.share_buy_link({ name })}
						title={m.share_buy_link({ name })}
						class="grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur active:scale-90"
					>
						<Zap class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
			</div>
		</div>

		{#if !soldOut}
			{#if inBag === 0}
				<button
					type="button"
					onclick={add}
					aria-label={isBox ? m.box_open_label({ name }) : m.product_add_label({ name })}
					class="absolute right-2 bottom-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--am-ink)] text-white shadow-lg transition-transform active:scale-90"
				>
					<Plus class="h-5 w-5" aria-hidden="true" />
				</button>
			{:else}
				<div
					class="absolute right-2 bottom-2 flex h-11 items-center rounded-full bg-[var(--am-ink)] text-white shadow-lg"
					role="group"
					aria-label={m.product_in_bag({ count: inBag })}
				>
					<button
						type="button"
						onclick={() => bag.set(product, inBag - 1)}
						aria-label={m.product_decrease({ name })}
						class="grid h-11 w-11 place-items-center rounded-full active:bg-white/15"
					>
						<Minus class="h-4 w-4" aria-hidden="true" />
					</button>
					<span class="min-w-4 text-center text-sm font-semibold tabular-nums" aria-live="polite">
						{inBag}
					</span>
					<button
						type="button"
						onclick={add}
						disabled={atMax}
						aria-label={m.product_increase({ name })}
						class="grid h-11 w-11 place-items-center rounded-full active:bg-white/15 disabled:opacity-40"
					>
						<Plus class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			{/if}
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1 pt-3">
		{#if product.bundle}
			<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{isBox ? m.bundle_build_own() : m.bundle_count({ count: product.bundle.items.length })}
			</p>
		{/if}
		<h3 class="text-[0.95rem] leading-snug font-medium text-foreground">{name}</h3>
		<p class="flex flex-wrap items-baseline gap-x-2 text-[0.95rem] font-semibold text-foreground">
			<span class="tabular-nums"
				>{isBox ? m.bundle_from({ price: birr(product.price) }) : birr(product.price)}</span
			>
			{#if isBox && product.bundle && product.bundle.discountPercent > 0}
				<span class="text-xs font-semibold text-[var(--am-ribbon)]">
					{m.bundle_save({ percent: product.bundle.discountPercent })}
				</span>
			{:else if product.bundle && product.bundle.fullPrice > product.price}
				<s class="text-xs font-normal text-muted-foreground tabular-nums"
					>{birr(product.bundle.fullPrice)}</s
				>
				<span class="text-xs font-semibold text-[var(--am-ribbon)]">
					{m.bundle_save({ percent: product.bundle.discountPercent })}
				</span>
			{/if}
		</p>
		{#if !soldOut && product.stockQty <= fewLeftAt}
			<p class="text-xs font-medium text-[var(--am-ribbon)]">
				{m.product_few_left({ count: product.stockQty })}
			</p>
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
