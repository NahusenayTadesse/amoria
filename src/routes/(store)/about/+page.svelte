<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Flower from '@lucide/svelte/icons/flower';
	import Gift from '@lucide/svelte/icons/gift';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Package from '@lucide/svelte/icons/package';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { reveal } from '$lib/actions/reveal';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import PhotoArt from '$lib/components/store/PhotoArt.svelte';
	import VisitBand from '$lib/components/store/VisitBand.svelte';

	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	const values = [
		{ title: m.about_value_1_title, body: m.about_value_1_body },
		{ title: m.about_value_2_title, body: m.about_value_2_body },
		{ title: m.about_value_3_title, body: m.about_value_3_body }
	];

	const offers = [
		{ icon: Flower, title: m.home_biz_decor, body: m.home_biz_decor_body, to: '/contact' },
		{ icon: Gift, title: m.home_biz_gifts, body: m.home_biz_gifts_body, to: '/shop' },
		{ icon: Package, title: m.home_biz_rentals, body: m.home_biz_rentals_body, to: '/contact' },
		{ icon: GraduationCap, title: m.home_biz_school, body: m.home_biz_school_body, to: '/school' }
	];
</script>

<svelte:head>
	<title>{m.about_meta_title()}</title>
	<meta name="description" content={m.about_meta_description()} />
	<meta property="og:title" content={m.about_meta_title()} />
	<meta property="og:description" content={m.about_meta_description()} />
	<meta property="og:type" content="website" />
</svelte:head>

<PageHero
	kicker={m.about_kicker()}
	before={m.about_h1_a()}
	accent={m.about_h1_b()}
	after={m.about_h1_c()}
	lede={m.about_lede()}
>
	{#snippet art()}
		<PhotoArt
			main={{ src: '/images/shop/shopfront.webp', w: 1280, h: 960, small: 640 }}
			side={{ src: '/images/demo/gallery-floral-tables.webp', w: 900, h: 601, small: 480 }}
		/>
	{/snippet}
</PageHero>

<!-- Story -->
<section class="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
	<div class="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
		<div use:reveal class="lg:sticky lg:top-28 lg:self-start">
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
				{m.about_story_kicker()}
			</p>
			<p class="accent mt-4 text-4xl leading-[1.12] text-foreground sm:text-5xl">
				{m.about_story_quote()}
			</p>
			<span class="mt-8 block h-px w-24 bg-[var(--am-foil)]"></span>
		</div>
		<div class="space-y-6 text-base text-muted-foreground sm:text-lg">
			<p use:reveal>{m.about_story_1()}</p>
			<p use:reveal style="--i: 1">{m.about_story_2()}</p>
			<p use:reveal style="--i: 2" class="font-medium text-foreground">{m.about_story_3()}</p>
		</div>
	</div>
</section>

<!-- Promises -->
<section class="relative isolate overflow-hidden bg-[var(--am-ink)] py-20 text-white sm:py-28">
	<div class="glow-plum" aria-hidden="true"></div>
	<div class="relative mx-auto max-w-6xl px-4 sm:px-8">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[#e6c473] uppercase">
				{m.about_values_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.about_values_heading()}
			</h2>
		</div>
		<ul class="mt-12 grid gap-5 sm:mt-16 md:grid-cols-3">
			{#each values as value, index (index)}
				<li
					use:reveal
					style="--i: {index}"
					class="group rounded-[1.5rem] border border-white/15 bg-white/[0.04] p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-[#e6c473]/60 hover:bg-white/[0.08]"
				>
					<span
						class="accent block text-5xl text-[#e6c473] transition-transform duration-500 group-hover:translate-x-1.5"
					>
						{index + 1}
					</span>
					<h3 class="display mt-5 text-xl font-bold sm:text-2xl">{value.title()}</h3>
					<p class="mt-2 text-[0.95rem] text-white/70">{value.body()}</p>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- What we do -->
<section class="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
	<div use:reveal class="max-w-2xl">
		<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
			{m.about_offer_kicker()}
		</p>
		<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
			{m.about_offer_heading()}
		</h2>
	</div>

	<ul class="mt-10 border-t border-border sm:mt-14">
		{#each offers as offer, index (index)}
			{@const Icon = offer.icon}
			<li use:reveal style="--i: {index}" class="border-b border-border">
				<a
					href={path(offer.to)}
					class="offer group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-6 sm:gap-8 sm:py-8"
				>
					<span
						class="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-[var(--am-ribbon)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-6deg] group-hover:bg-[var(--am-ribbon)] group-hover:text-white"
					>
						<Icon class="h-6 w-6" aria-hidden="true" />
					</span>
					<span class="min-w-0">
						<span
							class="display block text-xl font-bold transition-transform duration-500 group-hover:translate-x-1.5 sm:text-3xl"
						>
							{offer.title()}
						</span>
						<span class="mt-1 block max-w-[60ch] text-sm text-muted-foreground sm:text-base">
							{offer.body()}
						</span>
					</span>
					<ArrowRight
						class="h-6 w-6 text-foreground/40 transition-all duration-500 group-hover:translate-x-2 group-hover:text-[var(--am-ribbon)]"
						aria-hidden="true"
					/>
				</a>
			</li>
		{/each}
	</ul>
</section>

<!-- The shop -->
<VisitBand />

<!-- Call to action -->
<section class="cta relative isolate overflow-hidden bg-[var(--am-ribbon)] text-white">
	<div class="cta-glow" aria-hidden="true"></div>
	<div class="relative mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-24">
		<h2 use:reveal class="display max-w-3xl text-4xl leading-[1.05] font-bold sm:text-6xl">
			{m.about_cta_heading()}
		</h2>
		<div use:reveal style="--i: 1" class="mt-9 flex flex-wrap gap-3">
			<a
				href={path('/contact')}
				class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-white px-7 text-[0.95rem] font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
			>
				{m.about_cta_contact()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				/>
			</a>
			<a
				href={path('/shop')}
				class="inline-flex h-13 items-center rounded-full border border-white/40 px-7 text-[0.95rem] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
			>
				{m.about_cta_shop()}
			</a>
		</div>
	</div>
</section>

<style>
	.glow-plum {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				38rem 26rem at 0% 0%,
				color-mix(in oklab, var(--am-ribbon) 32%, transparent),
				transparent 70%
			),
			radial-gradient(
				30rem 22rem at 100% 100%,
				color-mix(in oklab, #e6c473 14%, transparent),
				transparent 70%
			);
	}
	.cta-glow {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(34rem 26rem at 100% 0%, rgb(255 255 255 / 0.16), transparent 65%),
			radial-gradient(
				30rem 24rem at 0% 100%,
				color-mix(in oklab, var(--am-ink) 45%, transparent),
				transparent 70%
			);
	}
	.cta-glow::after {
		content: '';
		position: absolute;
		inset: -20%;
		background: conic-gradient(
			from 0deg at 80% 30%,
			transparent 0 70%,
			rgb(255 255 255 / 0.08) 75%,
			transparent 80% 100%
		);
		animation: sweep 18s linear infinite;
	}
	@keyframes sweep {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cta-glow::after {
			animation: none;
		}
	}
</style>
