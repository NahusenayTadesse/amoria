<!--
	Create your own package: choose a container (a basket, a crate), fill it within its rules, then
	put it in the bag or go straight to checkout. The builder is the same one the product sheet
	uses; the checkout checks the rules again on the server.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import type { AppPath } from '$lib/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, localized } from '$lib/localized';
	import { buzz } from '$lib/haptics';
	import { roundBirr } from '$lib/money';
	import { Bag } from '$lib/components/store/bag.svelte';
	import { BoxDraft } from '$lib/components/store/boxDraft.svelte';
	import BoxBuilder from '$lib/components/store/BoxBuilder.svelte';

	let { data } = $props();

	const bag = new Bag(() => data.products);
	onMount(() => bag.restore());

	const boxes = $derived(data.products.filter((product) => product.bundle?.custom));
	let chosenSlug = $state(page.url.searchParams.get('box'));
	const box = $derived(boxes.find((b) => b.slug === chosenSlug) ?? boxes[0]);

	/** A fresh box for each container chosen. */
	const draft = $derived.by(() => {
		const bundle = box?.bundle;
		const offer = bundle?.custom;
		return bundle && offer
			? new BoxDraft(
					() => offer,
					() => bundle.discountPercent
				)
			: null;
	});

	let added = $state(false);

	function choose(slug: string) {
		chosenSlug = slug;
		added = false;
		replaceState(resolve(`${page.url.pathname}?box=${encodeURIComponent(slug)}` as AppPath), {});
		document.getElementById('fill')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const lines = $derived(
		draft
			? draft.picks.flatMap((pick) => {
					const choice = draft.offer.choices.find((c) => c.productId === pick.productId);
					return choice ? [{ ...pick, name: localized(choice, 'name'), price: choice.price }] : [];
				})
			: []
	);

	/** What the box still needs before it can go in the bag. */
	const hint = $derived.by(() => {
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

	function addToBag() {
		if (!box || !draft?.ready) return;
		bag.addBox(box, draft.picks);
		buzz();
		draft.reset();
		added = true;
	}

	function checkOut() {
		if (box && draft?.ready) bag.addBox(box, draft.picks);
		goto(resolve(localizeHref('/shop?bag=1') as AppPath));
	}
</script>

<svelte:head>
	<title>{m.build_meta_title()}</title>
	<meta name="description" content={m.build_meta_description()} />
	<meta property="og:title" content={m.build_meta_title()} />
	<meta property="og:description" content={m.build_meta_description()} />
	{#if boxes[0]?.image}<meta property="og:image" content={publicFileUrl(boxes[0].image)} />{/if}
</svelte:head>

{#snippet summary()}
	{#if box && draft}
		<h2 class="display text-xl font-bold">{m.build_summary()}</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			{m.build_in({ box: localized(draft.offer.container, 'name') })}
		</p>
		<ul class="mt-4 flex flex-col gap-2 text-sm">
			<li class="flex justify-between gap-3">
				<span>1 × {localized(draft.offer.container, 'name')}</span>
				<span class="tabular-nums">{birr(draft.offer.container.price)}</span>
			</li>
			{#each lines as line (line.productId)}
				<li class="flex justify-between gap-3">
					<span>{line.qty} × {line.name}</span>
					<span class="tabular-nums">{birr(roundBirr(line.price * line.qty))}</span>
				</li>
			{:else}
				<li class="text-muted-foreground">{m.build_nothing_yet()}</li>
			{/each}
		</ul>
		<dl class="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
			{#if draft.fullPrice > draft.price}
				<div class="flex justify-between text-[var(--am-ribbon)]">
					<dt>{m.bundle_save({ percent: box.bundle?.discountPercent ?? 0 })}</dt>
					<dd class="tabular-nums">−{birr(roundBirr(draft.fullPrice - draft.price))}</dd>
				</div>
			{/if}
			<div class="flex items-baseline justify-between">
				<dt class="font-semibold">{m.build_total()}</dt>
				<dd class="display text-2xl font-bold tabular-nums" aria-live="polite">
					{birr(draft.price)}
				</dd>
			</div>
		</dl>
	{/if}
{/snippet}

{#snippet actions(wide: boolean)}
	{#if added}
		<p class={['flex items-center gap-2 text-sm font-semibold', wide ? 'mb-3' : 'mb-2']}>
			<Check class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
			{m.build_added()}
		</p>
	{:else if hint}
		<p class="mb-2 text-sm text-muted-foreground" aria-live="polite">{hint}</p>
	{/if}
	<div class={['flex gap-3', wide && 'flex-col']}>
		{#if added}
			<button
				type="button"
				onclick={() => (added = false)}
				class={[
					'h-12 rounded-full border border-foreground/40 px-4 text-sm font-semibold',
					wide ? 'w-full' : 'flex-1'
				]}
			>
				{m.build_another()}
			</button>
			<button
				type="button"
				onclick={checkOut}
				class={[
					'h-12 rounded-full bg-foreground px-4 text-sm font-semibold text-background',
					wide ? 'w-full' : 'flex-1'
				]}
			>
				{m.build_checkout()}
			</button>
		{:else}
			<button
				type="button"
				onclick={addToBag}
				disabled={!draft?.ready}
				class={[
					'h-12 rounded-full border border-foreground/40 px-4 text-sm font-semibold disabled:opacity-40',
					wide ? 'w-full' : 'flex-1'
				]}
			>
				{m.box_add()}
			</button>
			<button
				type="button"
				onclick={checkOut}
				disabled={!draft?.ready}
				class={[
					'h-12 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-40',
					wide ? 'w-full' : 'flex-1'
				]}
			>
				{m.product_buy_now()}
			</button>
		{/if}
	</div>
{/snippet}

<div class="mx-auto max-w-6xl px-4 pt-6 pb-40 sm:px-8 sm:pt-10 lg:pb-24">
	<a
		href={resolve(localizeHref('/shop') as AppPath)}
		class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" aria-hidden="true" />
		{m.build_back()}
	</a>

	<header class="mt-4 max-w-2xl">
		<h1 class="display text-[2.1rem] leading-[1.05] font-bold sm:text-6xl">{m.build_heading()}</h1>
		<p class="mt-4 max-w-[52ch] text-base text-muted-foreground sm:text-lg">{m.build_intro()}</p>
	</header>

	{#if !box || !draft}
		<p class="mt-10 max-w-md rounded-[var(--radius)] bg-secondary p-6 text-muted-foreground">
			{m.build_empty()}
		</p>
	{:else}
		<section class="mt-10" aria-labelledby="choose">
			<h2 id="choose" class="display text-2xl font-bold">{m.build_step_container()}</h2>
			<ul class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each boxes as option (option.key)}
					{@const current = option.key === box.key}
					{@const soldOut = option.stockQty <= 0}
					<li>
						<button
							type="button"
							onclick={() => choose(option.slug)}
							disabled={soldOut}
							aria-pressed={current}
							class={[
								'flex w-full flex-col overflow-hidden rounded-[1.25rem] border-2 bg-card text-left transition-colors disabled:opacity-50',
								current ? 'border-[var(--am-ink)]' : 'border-border hover:border-foreground/40'
							]}
						>
							<div class="relative aspect-[4/3] bg-secondary">
								{#if option.image}
									<img
										src={publicFileUrl(option.image)}
										alt={option.imageAlt ?? ''}
										width="600"
										height="450"
										loading="eager"
										decoding="async"
										class="h-full w-full object-cover"
									/>
								{/if}
								{#if current}
									<span
										class="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-[var(--am-ink)] px-3 py-1 text-xs font-semibold text-white"
									>
										<Check class="h-3.5 w-3.5" aria-hidden="true" />
										{m.build_selected()}
									</span>
								{/if}
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-lg font-semibold">{localized(option, 'name')}</span>
								<span class="text-sm text-muted-foreground">
									{option.bundle?.custom
										? m.build_in({ box: localized(option.bundle.custom.container, 'name') })
										: ''}
								</span>
								<span class="mt-1 flex flex-wrap items-baseline gap-x-2">
									<span class="font-semibold tabular-nums">
										{soldOut ? m.product_sold_out() : m.bundle_from({ price: birr(option.price) })}
									</span>
									{#if (option.bundle?.discountPercent ?? 0) > 0}
										<span class="text-sm font-semibold text-[var(--am-ribbon)]">
											{m.bundle_save({ percent: option.bundle?.discountPercent ?? 0 })}
										</span>
									{/if}
								</span>
								{#if localized(option, 'description')}
									<span class="mt-1 text-sm text-muted-foreground">
										{localized(option, 'description')}
									</span>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<div class="mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
			<section id="fill" class="scroll-mt-24" aria-labelledby="fill-heading">
				<h2 id="fill-heading" class="display text-2xl font-bold">{m.build_step_fill()}</h2>
				<div class="mt-5">
					{#key box.key}<BoxBuilder {draft} />{/key}
				</div>
			</section>

			<aside class="hidden lg:block">
				<div class="sticky top-24 rounded-[1.5rem] border border-border bg-card p-6">
					{@render summary()}
					<div class="mt-6">{@render actions(true)}</div>
				</div>
			</aside>
		</div>
	{/if}
</div>

{#if box && draft}
	<div
		class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
	>
		<div class="mb-2 flex items-baseline justify-between">
			<span class="text-sm text-muted-foreground">
				{m.build_in({ box: localized(draft.offer.container, 'name') })}
			</span>
			<span class="display text-xl font-bold tabular-nums" aria-live="polite">
				{birr(draft.price)}
			</span>
		</div>
		{@render actions(false)}
	</div>
{/if}
