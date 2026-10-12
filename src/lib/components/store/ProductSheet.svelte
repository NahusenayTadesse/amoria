<!--
	A gift, opened: a swipeable row of its photos, the description, and the add-to-bag stepper with
	"Buy now". A build-your-own box shows its builder instead, and goes in the bag once it is full
	enough. A bottom sheet on phones, a side panel on wider screens. Open state is the page's
	shallow-routing state, so the Back button closes it.
-->
<script lang="ts">
	import Share2 from '@lucide/svelte/icons/share-2';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import * as Sheet from '@nahu/admin-kit/components/ui/sheet/index.js';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { MediaQuery } from 'svelte/reactivity';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, localized } from '$lib/localized';
	import { buzz } from '$lib/haptics';
	import { flyToBag } from '$lib/flyToBag';
	import { productLink, shareLink } from '$lib/share';
	import { getBag } from './bag.svelte';
	import { BoxDraft } from './boxDraft.svelte';
	import BoxBuilder from './BoxBuilder.svelte';
	import type { BoxOffer } from '$lib/bundle';

	type Product = {
		kind: 'product' | 'bundle';
		id: number;
		key: string;
		slug: string;
		name: string;
		nameAm: string | null;
		description: string | null;
		descriptionAm: string | null;
		price: number;
		stockQty: number;
		gallery: { fileName: string; alt: string | null }[];
		bundle: {
			items: { name: string; nameAm: string | null; qty: number }[];
			fullPrice: number;
			discountPercent: number;
			custom: BoxOffer | null;
		} | null;
	};
	type Props = { product: Product | undefined; onclose: () => void; onbuy: () => void };
	let { product, onclose, onbuy }: Props = $props();

	const bag = getBag();
	const wide = new MediaQuery('min-width: 640px');

	const name = $derived(product ? localized(product, 'name') : '');
	const description = $derived(product ? localized(product, 'description') : '');
	const inBag = $derived(product ? bag.qtyOf(product.key) : 0);
	const soldOut = $derived(!product || product.stockQty <= 0);
	const atMax = $derived(product ? inBag >= bag.maxFor(product) : true);

	let addButton = $state<HTMLElement>();

	/** A build-your-own box: filled here, then added as its own line. New for each product opened. */
	const draft = $derived.by(() => {
		const bundle = product?.bundle;
		const offer = bundle?.custom;
		return bundle && offer
			? new BoxDraft(
					() => offer,
					() => bundle.discountPercent
				)
			: null;
	});

	/** What the box still needs before it can go in the bag. */
	const boxHint = $derived.by(() => {
		if (!draft || draft.ready) return '';
		const short = draft.problems.find((p) => p.kind === 'too_few');
		if (short?.kind === 'too_few') {
			return m.box_need({
				count: short.rule.minQty - short.count,
				group: localized(short.rule, 'name')
			});
		}
		return m.box_pick_one();
	});

	function addBox() {
		if (!product || !draft?.ready) return;
		bag.addBox(product, draft.picks);
		buzz();
		flyToBag(addButton, product.gallery[0] ? publicFileUrl(product.gallery[0].fileName) : null);
		draft.reset();
	}

	function buyBox() {
		if (!product || !draft?.ready) return;
		bag.addBox(product, draft.picks);
		draft.reset();
		onbuy();
	}

	function add() {
		if (!product) return;
		bag.add(product);
		buzz();
		flyToBag(addButton, product.gallery[0] ? publicFileUrl(product.gallery[0].fileName) : null);
	}

	function share() {
		if (!product) return;
		void shareLink({
			title: name,
			text: `${name}: ${birr(product.price)}`,
			url: productLink(product.slug)
		});
	}

	/** Straight to checkout: in the bag once (not added again), then the checkout opens. */
	function buyNow() {
		if (!product) return;
		if (inBag === 0) bag.add(product);
		onbuy();
	}
</script>

<Sheet.Root open={!!product} onOpenChange={(next) => !next && onclose()}>
	<Sheet.Content
		data-site-type
		side={wide.current ? 'right' : 'bottom'}
		class={[
			'store flex flex-col gap-0 p-0',
			wide.current ? 'w-full sm:max-w-md' : 'max-h-[92dvh] rounded-t-[1.25rem]'
		]}
	>
		{#if product}
			<Sheet.Header class="sr-only">
				<Sheet.Title>{name}</Sheet.Title>
				<Sheet.Description>{birr(product.price)}</Sheet.Description>
			</Sheet.Header>

			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if product.gallery.length}
					<ul
						class="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
					>
						{#each product.gallery as photo, index (photo.fileName)}
							<li class="w-full shrink-0 snap-center">
								<img
									src={publicFileUrl(photo.fileName)}
									alt={photo.alt ?? name}
									width="800"
									height="800"
									loading={index === 0 ? 'eager' : 'lazy'}
									decoding="async"
									class="aspect-square w-full object-cover"
								/>
							</li>
						{/each}
					</ul>
					{#if product.gallery.length > 1}
						<p class="mt-2 text-center text-xs text-muted-foreground" aria-hidden="true">
							{'• '.repeat(product.gallery.length).trim()}
						</p>
					{/if}
				{/if}

				<div class="px-5 pt-4 pb-5">
					<div class="flex items-start justify-between gap-3">
						<h2 class="display text-2xl leading-tight font-bold">{name}</h2>
						<button
							type="button"
							onclick={share}
							aria-label={m.product_share({ name })}
							class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border active:bg-secondary"
						>
							<Share2 class="h-4 w-4" aria-hidden="true" />
						</button>
					</div>
					{#if draft}
						<p class="mt-1 flex flex-wrap items-baseline gap-x-3 text-xl font-semibold">
							<span class="tabular-nums" aria-live="polite"
								>{draft.count
									? birr(draft.price)
									: m.bundle_from({ price: birr(product.price) })}</span
							>
							{#if draft.count && draft.fullPrice > draft.price}
								<s class="text-sm font-normal text-muted-foreground tabular-nums"
									>{birr(draft.fullPrice)}</s
								>
							{/if}
							{#if product.bundle && product.bundle.discountPercent > 0}
								<span class="text-sm font-semibold text-[var(--am-ribbon)]">
									{m.bundle_save({ percent: product.bundle.discountPercent })}
								</span>
							{/if}
						</p>
					{:else}
						<p class="mt-1 flex flex-wrap items-baseline gap-x-3 text-xl font-semibold">
							<span class="tabular-nums">{birr(product.price)}</span>
							{#if product.bundle && product.bundle.fullPrice > product.price}
								<s class="text-sm font-normal text-muted-foreground tabular-nums"
									>{birr(product.bundle.fullPrice)}</s
								>
								<span class="text-sm font-semibold text-[var(--am-ribbon)]">
									{m.bundle_save({ percent: product.bundle.discountPercent })}
								</span>
							{/if}
						</p>
					{/if}
					{#if soldOut}
						<p class="mt-2 text-sm font-medium text-muted-foreground">{m.product_sold_out()}</p>
					{:else if product.stockQty <= 3 && !draft}
						<p class="mt-2 text-sm font-medium text-[var(--am-ribbon)]">
							{m.product_few_left({ count: product.stockQty })}
						</p>
					{/if}
					{#if description}
						<p class="mt-4 text-[0.95rem] whitespace-pre-line text-muted-foreground">
							{description}
						</p>
					{/if}
					{#if draft}
						{#if !soldOut}
							<div class="mt-6"><BoxBuilder {draft} /></div>
						{/if}
					{:else if product.bundle}
						<section class="mt-5 rounded-[var(--radius)] bg-secondary p-4">
							<h3 class="text-sm font-semibold">{m.bundle_inside()}</h3>
							<ul class="mt-2 flex flex-col gap-1.5 text-[0.95rem]">
								{#each product.bundle.items as item, index (index)}
									<li class="flex justify-between gap-3">
										<span>{localized(item, 'name')}</span>
										<span class="text-muted-foreground tabular-nums">×{item.qty}</span>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				</div>
			</div>

			{#if !soldOut && draft}
				<div
					bind:this={addButton}
					class="border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
				>
					{#if boxHint}
						<p class="mb-2 text-sm text-muted-foreground" aria-live="polite">{boxHint}</p>
					{/if}
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={addBox}
							disabled={!draft.ready}
							class="h-12 flex-1 rounded-full border border-foreground/40 px-4 text-sm font-semibold active:bg-secondary disabled:opacity-40"
						>
							{m.box_add()}
						</button>
						<button
							type="button"
							onclick={buyBox}
							disabled={!draft.ready}
							aria-label={m.product_buy_now_label({ name })}
							class="h-12 flex-1 rounded-full bg-foreground px-4 text-sm font-semibold text-background active:opacity-90 disabled:opacity-40"
						>
							{m.product_buy_now()}
						</button>
					</div>
				</div>
			{:else if !soldOut}
				<div
					bind:this={addButton}
					class="flex items-center gap-3 border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
				>
					{#if inBag === 0}
						<button
							type="button"
							onclick={add}
							class="h-12 flex-1 rounded-full border border-foreground/40 px-4 text-sm font-semibold active:bg-secondary"
						>
							{m.product_add()}
						</button>
					{:else}
						<div
							class="flex h-12 flex-1 items-center justify-between rounded-full border border-foreground/40"
							role="group"
							aria-label={m.product_in_bag({ count: inBag })}
						>
							<button
								type="button"
								onclick={() => product && bag.set(product, inBag - 1)}
								aria-label={m.product_decrease({ name })}
								class="grid h-12 w-12 place-items-center rounded-full active:bg-secondary"
							>
								<Minus class="h-4 w-4" aria-hidden="true" />
							</button>
							<span class="text-sm font-semibold tabular-nums" aria-live="polite">{inBag}</span>
							<button
								type="button"
								onclick={add}
								disabled={atMax}
								aria-label={m.product_increase({ name })}
								class="grid h-12 w-12 place-items-center rounded-full active:bg-secondary disabled:opacity-40"
							>
								<Plus class="h-4 w-4" aria-hidden="true" />
							</button>
						</div>
					{/if}
					<button
						type="button"
						onclick={buyNow}
						aria-label={m.product_buy_now_label({ name })}
						class="h-12 flex-1 rounded-full bg-foreground px-4 text-sm font-semibold text-background active:opacity-90"
					>
						{m.product_buy_now()}
					</button>
				</div>
			{/if}
		{/if}
	</Sheet.Content>
</Sheet.Root>
