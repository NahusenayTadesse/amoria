<script lang="ts">
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Flower from '@lucide/svelte/icons/flower';
	import Gift from '@lucide/svelte/icons/gift';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Package from '@lucide/svelte/icons/package';
	import Phone from '@lucide/svelte/icons/phone';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { birr, bothCalendars, localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import { chatHref, telHref } from '$lib/chat';
	import ChatButtons from '$lib/components/store/ChatButtons.svelte';
	import HeroArt from '$lib/components/store/home/HeroArt.svelte';
	import HeroPhotos from '$lib/components/store/home/HeroPhotos.svelte';
	import VisitBand from '$lib/components/store/VisitBand.svelte';
	import HomeGallery from '$lib/components/store/home/HomeGallery.svelte';

	let { data } = $props();

	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	/**
	 * Where "ask us" buttons go: a chat with the message already typed. Until the shop has saved a
	 * WhatsApp number or Telegram handle in Settings, they scroll to the contact section instead.
	 */
	function talk(text: string): string {
		return chatHref(data.contact, text) ?? '#contact';
	}
	const external = (href: string) => href.startsWith('https://');
	const hasChat = $derived(!!(data.contact.whatsapp.trim() || data.contact.telegram.trim()));

	const events = [
		m.home_event_wedding,
		m.home_event_birthday,
		m.home_event_engagement,
		m.home_event_baby_shower,
		m.home_event_graduation,
		m.home_event_corporate
	];

	const steps = [
		{ title: m.home_step_1_title, body: m.home_step_1_body },
		{ title: m.home_step_2_title, body: m.home_step_2_body },
		{ title: m.home_step_3_title, body: m.home_step_3_body }
	];

	const tiers = {
		basic: m.home_tier_basic,
		premium: m.home_tier_premium,
		luxury: m.home_tier_luxury
	};

	/** The pointer's place on a card, for the soft light that follows it (`.spot` in the styles). */
	function spot(event: PointerEvent) {
		const card = event.currentTarget as HTMLElement;
		const box = card.getBoundingClientRect();
		card.style.setProperty('--px', `${event.clientX - box.left}px`);
		card.style.setProperty('--py', `${event.clientY - box.top}px`);
	}

	const intakeStart = $derived(
		data.intake ? bothCalendars(new Date(`${data.intake.startDate}T12:00:00+03:00`)) : ''
	);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'LocalBusiness',
			name: 'Amoria',
			url: page.url.origin,
			description: m.home_meta_description(),
			telephone: data.contact.phone || undefined,
			email: data.contact.email || undefined,
			address: {
				'@type': 'PostalAddress',
				streetAddress: data.contact.address,
				addressLocality: 'Addis Ababa',
				addressCountry: 'ET'
			}
		}).replace(/</g, '\\u003c')
	);
	const ldTag = $derived(`<script type="application/ld+json">${jsonLd}<${'/'}script>`);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- chat, map, phone and #anchor links are not app routes -->
<svelte:head>
	<title>{m.home_meta_title()}</title>
	<meta name="description" content={m.home_meta_description()} />
	<meta property="og:title" content={m.home_meta_title()} />
	<meta property="og:description" content={m.home_meta_description()} />
	<meta property="og:type" content="website" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ldTag}
</svelte:head>

<!-- ============================== Hero ============================== -->
<section class="hero relative isolate overflow-hidden">
	<div
		class="mx-auto grid max-w-6xl items-center gap-6 px-4 pt-10 pb-12 sm:px-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-6 lg:pb-16"
	>
		<div class="relative z-10">
			<p
				class="rise flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase"
				style="--i: 0"
			>
				<span class="h-px w-10 bg-[var(--am-foil)]"></span>
				{m.home_eyebrow()}
			</p>

			<h1
				class="display mt-5 text-[2.75rem] leading-[1.02] font-bold text-foreground sm:text-6xl lg:text-[4.6rem]"
			>
				<span class="line"><span class="line-in" style="--i: 1">{m.home_h1_a()}</span></span>
				<span class="line">
					<span class="line-in" style="--i: 2">
						<span class="accent text-[var(--am-ribbon)]">{m.home_h1_b()}</span>
						{m.home_h1_c()}
					</span>
				</span>
			</h1>

			<p class="rise mt-6 max-w-[46ch] text-base text-muted-foreground sm:text-lg" style="--i: 4">
				{m.home_lede()}
			</p>

			<div class="rise mt-8 flex flex-wrap items-center gap-3" style="--i: 5">
				<a
					href={path('/decor/quote')}
					class="btn-shine group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
				>
					{m.home_cta_plan()}
					<ArrowRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</a>
				<a
					href={path('/shop')}
					class="inline-flex h-13 items-center rounded-full border border-foreground/30 px-7 text-[0.95rem] font-semibold text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground"
				>
					{m.home_cta_shop()}
				</a>
			</div>

			<p class="rise mt-6 max-w-[48ch] text-sm text-muted-foreground" style="--i: 6">
				{m.home_pay_note()}
			</p>
		</div>

		<div class="relative mx-auto w-full max-w-[30rem] lg:max-w-none">
			<div class="glow" aria-hidden="true"></div>
			<div class="relative mx-auto aspect-[600/660] w-full max-w-[34rem]">
				<HeroArt />
				<HeroPhotos />
			</div>
		</div>
	</div>
</section>

<!-- ============================== Celebrations marquee ============================== -->
<section aria-label={m.home_events_label()} class="marquee border-y border-border bg-card py-4">
	<div class="marquee-track">
		{#each [0, 1] as copy (copy)}
			<ul class="marquee-group" aria-hidden={copy === 1 ? 'true' : undefined}>
				{#each events as label, index (index)}
					<li class="flex items-center gap-8">
						<span
							class="display text-lg font-semibold whitespace-nowrap text-foreground/80 sm:text-xl"
							>{label()}</span
						>
						<span class="text-[var(--am-foil)]" aria-hidden="true">✦</span>
					</li>
				{/each}
			</ul>
		{/each}
	</div>
</section>

<!-- ============================== The four businesses ============================== -->
<section class="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
	<div use:reveal class="max-w-2xl">
		<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
			{m.home_biz_kicker()}
		</p>
		<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
			{m.home_biz_heading()}
		</h2>
	</div>

	<div class="mt-10 grid gap-4 sm:mt-14 lg:grid-cols-[1.15fr_1fr] lg:grid-rows-3">
		<!-- Décor is the heart of the house, so it is the tall dark card. -->
		<a
			use:reveal
			onpointermove={spot}
			href={path('/decor/quote')}
			class="spot group relative flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-[1.5rem] bg-[var(--am-ink)] p-7 text-white sm:p-10 lg:row-span-3"
		>
			<img
				src={asset('/images/demo/gallery-hall-drapes-480.webp')}
				alt=""
				width="900"
				height="599"
				loading="lazy"
				decoding="async"
				class="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-[1400ms] ease-out group-hover:scale-105"
			/>
			<div class="decor-bg" aria-hidden="true"></div>
			<div
				class="absolute inset-0 bg-gradient-to-t from-[var(--am-ink)] via-[var(--am-ink)]/55 to-[var(--am-ink)]/10"
				aria-hidden="true"
			></div>
			<div class="relative flex items-start justify-between">
				<span class="accent text-6xl text-[#e6c473] sm:text-7xl">01</span>
				<span
					class="grid h-12 w-12 place-items-center rounded-full border border-white/25 transition-all duration-500 group-hover:rotate-45 group-hover:border-[#e6c473] group-hover:bg-[#e6c473] group-hover:text-[var(--am-ink)]"
				>
					<ArrowUpRight class="h-5 w-5" aria-hidden="true" />
				</span>
			</div>
			<div class="relative">
				<Flower
					class="mb-5 h-8 w-8 text-[#e6c473] transition-transform duration-700 group-hover:rotate-90"
					aria-hidden="true"
				/>
				<h3 class="display text-3xl leading-tight font-bold sm:text-4xl">{m.home_biz_decor()}</h3>
				<p class="mt-3 max-w-[38ch] text-[0.95rem] text-white/75 sm:text-base">
					{m.home_biz_decor_body()}
				</p>
				<span
					class="mt-6 inline-flex items-center gap-2 border-b border-[#e6c473]/60 pb-1 text-sm font-semibold text-[#f1d795]"
					>{m.home_biz_decor_cta()}</span
				>
			</div>
		</a>

		{#snippet card(
			n: string,
			title: string,
			body: string,
			cta: string,
			href: string,
			Icon: typeof Gift,
			delay: number,
			photo: string
		)}
			<a
				use:reveal
				onpointermove={spot}
				{href}
				target={external(href) ? '_blank' : undefined}
				rel={external(href) ? 'noopener noreferrer' : undefined}
				style="--i: {delay}"
				class="spot group relative flex items-center gap-5 overflow-hidden rounded-[1.5rem] border border-border bg-card p-6 transition-[border-color,transform,box-shadow] duration-500 hover:-translate-y-1 hover:border-[var(--am-ribbon)]/40 hover:shadow-[0_24px_50px_-28px_var(--am-ribbon)] sm:p-7"
			>
				<span
					class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-[var(--am-ribbon)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-6deg] group-hover:bg-[var(--am-ribbon)] group-hover:text-white"
				>
					<Icon class="h-6 w-6" aria-hidden="true" />
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex items-baseline gap-3">
						<span class="accent text-sm text-[var(--am-foil)]">{n}</span>
						<h3 class="display text-xl leading-tight font-bold sm:text-2xl">{title}</h3>
					</div>
					<p class="mt-1.5 text-sm text-muted-foreground">{body}</p>
					<span
						class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--am-ribbon)]"
					>
						{cta}
						<ArrowRight
							class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5"
							aria-hidden="true"
						/>
					</span>
				</div>
				<img
					src={asset(photo)}
					alt=""
					width="160"
					height="160"
					loading="lazy"
					decoding="async"
					class="hidden h-24 w-24 shrink-0 rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105 sm:block lg:h-28 lg:w-28"
				/>
			</a>
		{/snippet}

		{@render card(
			'02',
			m.home_biz_gifts(),
			m.home_biz_gifts_body(),
			m.home_biz_gifts_cta(),
			path('/shop'),
			Gift,
			1,
			'/images/demo/hero-bouquet.webp'
		)}
		{@render card(
			'03',
			m.home_biz_rentals(),
			m.home_biz_rentals_body(),
			m.home_biz_rentals_cta(),
			talk(m.chat_rentals()),
			Package,
			2,
			'/images/demo/gallery-long-table-480.webp'
		)}
		{@render card(
			'04',
			m.home_biz_school(),
			m.home_biz_school_body(),
			m.home_biz_school_cta(),
			path('/school'),
			GraduationCap,
			3,
			'/images/demo/gallery-centerpiece-480.webp'
		)}
	</div>
</section>

<!-- ============================== Featured gifts ============================== -->
{#if data.featured.length}
	<section class="bg-card py-12 sm:py-28">
		<div class="mx-auto max-w-6xl px-4 sm:px-8">
			<div use:reveal class="flex flex-wrap items-end justify-between gap-4">
				<div class="max-w-xl">
					<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
						{m.home_gifts_kicker()}
					</p>
					<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
						{m.home_gifts_heading()}
					</h2>
				</div>
				<a
					href={path('/shop')}
					class="link-arrow group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground"
				>
					<span class="link-arrow-text">{m.home_gifts_all()}</span>
					<ArrowRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5"
						aria-hidden="true"
					/>
				</a>
			</div>
		</div>

		<ul
			class="scroller mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mt-14 sm:gap-6 sm:px-[max(2rem,calc((100vw-72rem)/2+2rem))]"
		>
			{#each data.featured as gift, index (gift.slug)}
				{@const name = localized(gift, 'name')}
				<li
					use:reveal
					style="--i: {index}"
					class="w-[68%] shrink-0 snap-start sm:w-[34%] lg:w-[23%]"
				>
					<a href={path(`/buy/${gift.slug}`)} class="tile group block">
						<div class="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-secondary">
							{#if gift.image}
								<img
									src={publicFileUrl(gift.image)}
									alt={gift.imageAlt ?? name}
									loading="lazy"
									decoding="async"
									width="480"
									height="600"
									class="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
								/>
							{:else}
								<div class="wrapped absolute inset-0" aria-hidden="true"></div>
							{/if}
							{#if gift.isFeatured}
								<span
									class="absolute top-3 left-3 rounded-full bg-[var(--am-foil)] px-2.5 py-1 text-xs font-semibold text-white"
									>{m.product_featured()}</span
								>
							{/if}
							<span
								class="absolute inset-x-3 bottom-3 flex translate-y-3 items-center justify-center rounded-full bg-white/95 py-2.5 text-sm font-semibold text-[var(--am-ink)] opacity-0 shadow-lg transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 max-sm:translate-y-0 max-sm:opacity-100"
							>
								{m.home_gifts_buy()}
							</span>
						</div>
						<h3 class="mt-3 text-[0.95rem] leading-snug font-medium">{name}</h3>
						<p class="text-[0.95rem] font-semibold tabular-nums">{birr(gift.price)}</p>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- ============================== How décor works ============================== -->
<section
	class="steps relative isolate overflow-hidden bg-[var(--am-ink)] py-12 text-white sm:py-28"
>
	<img
		src={asset('/images/demo/gallery-evening-hall-480.webp')}
		alt=""
		width="900"
		height="600"
		loading="lazy"
		decoding="async"
		class="absolute inset-0 h-full w-full object-cover opacity-20"
	/>
	<div class="stars" aria-hidden="true"></div>
	<div class="relative mx-auto max-w-6xl px-4 sm:px-8">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[#e6c473] uppercase">
				{m.home_steps_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.home_steps_heading()}
			</h2>
		</div>

		<ol class="mt-8 grid gap-7 sm:mt-16 sm:gap-10 md:grid-cols-3 md:gap-8">
			{#each steps as step, index (index)}
				<li use:reveal style="--i: {index + 1}" class="step relative">
					<div
						class="step-line absolute top-[2.35rem] left-0 hidden h-px w-[calc(100%+2rem)] bg-gradient-to-r from-[#e6c473] to-[#e6c473]/0 md:block"
						aria-hidden="true"
					></div>
					<span
						class="accent relative inline-block bg-[var(--am-ink)] pr-4 text-6xl text-[#e6c473] sm:text-7xl"
						>{index + 1}</span
					>
					<h3 class="display mt-5 text-xl font-bold sm:text-2xl">{step.title()}</h3>
					<p class="mt-2 max-w-[34ch] text-[0.95rem] text-white/70">{step.body()}</p>
				</li>
			{/each}
		</ol>

		<div use:reveal class="mt-12 sm:mt-16">
			<a
				href={path('/decor/quote')}
				class="btn-shine group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-full bg-[#e6c473] px-7 text-[0.95rem] font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
			>
				{m.home_cta_plan()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				/>
			</a>
		</div>
	</div>
</section>

<!-- ============================== Packages ============================== -->
{#if data.packages.length}
	<section class="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
				{m.home_packages_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.home_packages_heading()}
			</h2>
		</div>

		<div
			class="mt-8 max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:[scrollbar-width:none] max-md:gap-4 max-md:overflow-x-auto max-md:px-4 max-md:pb-2 sm:mt-14 md:grid md:grid-cols-3 md:gap-5 max-md:[&::-webkit-scrollbar]:hidden"
		>
			{#each data.packages as pack, index (pack.id)}
				{@const name = localized(pack, 'name')}
				{@const summary = localized(pack, 'summary')}
				{@const inclusions =
					getLocale() === 'am' && pack.inclusionsAm.length ? pack.inclusionsAm : pack.inclusions}
				<article
					use:reveal
					style="--i: {index}"
					class={[
						'pack group flex flex-col overflow-hidden rounded-[1.5rem] border bg-card transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-32px_var(--am-ink)] max-md:w-[80%] max-md:shrink-0 max-md:snap-center',
						pack.tier === 'premium' ? 'border-[var(--am-foil)]' : 'border-border'
					]}
				>
					<div class="relative aspect-[4/3] overflow-hidden bg-secondary">
						{#if pack.image}
							<img
								src={publicFileUrl(pack.image)}
								alt={pack.imageAlt ?? name}
								loading="lazy"
								decoding="async"
								width="640"
								height="480"
								class="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
							/>
						{:else}
							<div
								class={['pack-art absolute inset-0', `tier-${pack.tier}`]}
								aria-hidden="true"
							></div>
						{/if}
						<span
							class="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold tracking-wide text-[var(--am-ink)] uppercase"
						>
							{tiers[pack.tier]()}
						</span>
					</div>
					<div class="flex flex-1 flex-col p-6">
						<p class="text-xs font-semibold tracking-[0.18em] text-[var(--am-foil)] uppercase">
							{localized({ name: pack.eventName, nameAm: pack.eventNameAm }, 'name')}
						</p>
						<h3 class="display mt-1 text-2xl font-bold">{name}</h3>
						{#if summary}<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">
								{summary}
							</p>{/if}
						{#if inclusions.length}
							<ul class="mt-4 space-y-2 text-sm">
								{#each inclusions as item, i (i)}
									<li class="flex gap-2.5">
										<Check
											class="mt-0.5 h-4 w-4 shrink-0 text-[var(--am-ribbon)]"
											aria-hidden="true"
										/>{item}
									</li>
								{/each}
							</ul>
						{/if}
						<div class="mt-auto flex items-end justify-between gap-3 pt-6">
							<div>
								<p class="text-xs text-muted-foreground">{m.home_packages_from()}</p>
								<p class="display text-xl font-bold tabular-nums">{birr(pack.startingPrice)}</p>
							</div>
							<a
								href={talk(m.chat_package({ name }))}
								target={external(talk(m.chat_package({ name }))) ? '_blank' : undefined}
								rel={external(talk(m.chat_package({ name }))) ? 'noopener noreferrer' : undefined}
								class="inline-flex h-11 items-center gap-1.5 rounded-full border border-foreground/30 px-4 text-sm font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
							>
								{m.home_packages_ask()}
								<ArrowUpRight class="h-4 w-4" aria-hidden="true" />
							</a>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}

<!-- ============================== Portfolio ============================== -->
{#if data.portfolio.length}
	<section class="bg-card py-12 sm:py-28">
		<div class="mx-auto max-w-6xl px-4 sm:px-8">
			<div use:reveal class="max-w-2xl">
				<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
					{m.home_portfolio_kicker()}
				</p>
				<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
					{m.home_portfolio_heading()}
				</h2>
			</div>

			<ul class="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-5 lg:grid-cols-3">
				{#each data.portfolio as item, index (item.id)}
					{@const title = localized(item, 'title')}
					<li
						use:reveal
						style="--i: {index % 3}"
						class={[
							'relative overflow-hidden rounded-[1.25rem] bg-secondary',
							index === 0 && 'lg:col-span-2 lg:row-span-2'
						]}
					>
						<figure class="group relative h-full">
							<img
								src={publicFileUrl(item.image)}
								alt={item.imageAlt ?? title}
								loading="lazy"
								decoding="async"
								width="800"
								height="800"
								class="aspect-square h-full w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]"
							/>
							<figcaption
								class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--am-ink)]/85 to-transparent p-4 pt-14 text-white sm:p-6"
							>
								{#if item.eventName}
									<p class="text-xs font-semibold tracking-[0.18em] text-[#f1d795] uppercase">
										{localized({ name: item.eventName, nameAm: item.eventNameAm }, 'name')}
									</p>
								{/if}
								<p class="display text-lg font-bold sm:text-xl">{title}</p>
							</figcaption>
						</figure>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<!-- ============================== Décor school ============================== -->
<section id="school" class="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28">
	<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
		<div use:reveal>
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
				{m.home_school_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.home_school_heading()}
			</h2>
			<p class="mt-5 max-w-[46ch] text-base text-muted-foreground sm:text-lg">
				{m.home_school_body()}
			</p>
			<a
				href={data.intake
					? path(`/school/${data.intake.courseSlug}/register?class=${data.intake.id}`)
					: path('/school')}
				class="btn-shine group relative mt-8 inline-flex h-13 items-center gap-2 overflow-hidden rounded-full bg-foreground px-7 text-[0.95rem] font-semibold text-background transition-transform duration-300 hover:-translate-y-0.5"
			>
				{data.intake ? m.home_school_cta() : m.home_biz_school_cta()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				/>
			</a>
		</div>

		<div
			use:reveal
			style="--i: 2"
			class="school-card relative overflow-hidden rounded-[1.75rem] border border-border bg-secondary p-7 sm:p-9"
		>
			<img
				src={asset('/images/demo/gallery-ceremony-chairs-480.webp')}
				alt=""
				width="900"
				height="1350"
				loading="lazy"
				decoding="async"
				class="-mx-7 -mt-7 mb-6 h-44 w-[calc(100%+3.5rem)] max-w-none object-cover sm:-mx-9 sm:-mt-9 sm:mb-8 sm:h-52 sm:w-[calc(100%+4.5rem)]"
			/>
			{#if data.intake}
				{@const intake = data.intake}
				<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase">
					{m.home_school_next()}
				</p>
				<h3 class="display relative mt-2 text-2xl font-bold sm:text-3xl">
					{localized({ name: intake.courseTitle, nameAm: intake.courseTitleAm }, 'name')}
				</h3>

				<dl class="relative mt-6 grid gap-4 text-sm sm:grid-cols-2">
					<div>
						<dt class="text-muted-foreground">{m.home_school_starts()}</dt>
						<dd class="mt-0.5 font-semibold">{intakeStart}</dd>
						{#if intake.scheduleText}<dd class="text-muted-foreground">
								{intake.scheduleText}
							</dd>{/if}
					</div>
					<div>
						<dt class="text-muted-foreground">{m.home_school_fee()}</dt>
						<dd class="mt-0.5 font-semibold tabular-nums">{birr(intake.fee)}</dd>
					</div>
				</dl>

				<div class="relative mt-7">
					<div class="seats flex flex-wrap gap-1.5" aria-hidden="true">
						{#each Array.from({ length: Math.min(intake.seatsLeft, 14) }, (_, n) => n) as i (i)}
							<span class="seat" style="--i: {i}"></span>
						{/each}
					</div>
					<p class="mt-3 text-sm font-semibold text-[var(--am-ribbon)]">
						{intake.seatsLeft === 1
							? m.home_school_seat_one()
							: m.home_school_seats({ count: intake.seatsLeft })}
					</p>
				</div>
			{:else}
				<p class="display relative text-xl leading-snug font-bold sm:text-2xl">
					{m.home_school_none()}
				</p>
			{/if}
		</div>
	</div>
</section>

<!-- ============================== Gallery ============================== -->
<HomeGallery />

<!-- ============================== The shop ============================== -->
<VisitBand />

<!-- ============================== Contact ============================== -->
<section
	id="contact"
	class="contact relative isolate scroll-mt-16 overflow-hidden bg-[var(--am-ribbon)] text-white"
>
	<div class="ribbon-bg" aria-hidden="true"></div>
	<div class="relative mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
		<div use:reveal class="max-w-3xl">
			<h2 class="display text-4xl leading-[1.05] font-bold sm:text-6xl">
				{m.home_contact_heading()}
			</h2>
			<p class="mt-5 max-w-[50ch] text-base text-white/85 sm:text-lg">{m.home_contact_body()}</p>
		</div>

		<div use:reveal style="--i: 1" class="mt-9 flex flex-wrap items-center gap-3">
			{#if hasChat}
				<ChatButtons
					whatsapp={data.contact.whatsapp}
					telegram={data.contact.telegram}
					text={m.chat_general()}
					tone="light"
				/>
			{:else}
				<p class="rounded-full border border-white/30 px-5 py-3 text-sm text-white/90">
					{m.home_contact_soon()}
				</p>
			{/if}
			{#if telHref(data.contact.phone)}
				<a
					href={telHref(data.contact.phone)}
					class="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/40 px-6 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
				>
					<Phone class="h-4.5 w-4.5" aria-hidden="true" />
					{m.home_contact_call()}
				</a>
			{/if}
		</div>

		<div
			use:reveal
			style="--i: 2"
			class="mt-14 flex flex-wrap items-start gap-x-12 gap-y-5 border-t border-white/25 pt-8 text-sm"
		>
			<div class="flex items-start gap-3">
				<MapPin class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
				<div>
					<p class="font-semibold">{m.home_contact_visit()}</p>
					<p class="text-white/85">{data.contact.address}</p>
					{#if data.contact.mapUrl}
						<a
							href={data.contact.mapUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-1 inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:text-white/80"
						>
							{m.home_contact_map()}
							<ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	/* ---------- Hero ---------- */
	.hero {
		background:
			radial-gradient(
				60rem 40rem at 88% -10%,
				color-mix(in oklab, var(--am-ribbon) 13%, transparent),
				transparent 60%
			),
			radial-gradient(
				44rem 34rem at -8% 108%,
				color-mix(in oklab, var(--am-foil) 16%, transparent),
				transparent 60%
			),
			var(--background);
	}
	.glow {
		position: absolute;
		inset: 8% 6%;
		border-radius: 50%;
		background: radial-gradient(
			closest-side,
			color-mix(in oklab, var(--am-ribbon) 22%, transparent),
			transparent
		);
		filter: blur(30px);
		animation: breathe 7s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			transform: scale(1.08);
			opacity: 0.75;
		}
	}

	/* Headline lines slide up out of a mask. */
	.line {
		display: block;
		overflow: hidden;
		padding-bottom: 0.14em;
		margin-bottom: -0.14em;
	}
	.line-in {
		display: block;
		animation: line-up 1.1s cubic-bezier(0.2, 0.75, 0.2, 1) calc(var(--i) * 0.14s + 0.05s) both;
	}
	@keyframes line-up {
		from {
			transform: translateY(112%);
		}
	}
	.rise {
		animation: rise 0.9s cubic-bezier(0.2, 0.75, 0.2, 1) calc(var(--i) * 0.12s + 0.1s) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(18px);
		}
	}

	/* A sheen sweeps across a primary button on hover. */
	.btn-shine::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			105deg,
			transparent 35%,
			rgb(255 255 255 / 0.4) 50%,
			transparent 65%
		);
		transform: translateX(-120%);
		transition: transform 0.9s ease;
	}
	.btn-shine:hover::after {
		transform: translateX(120%);
	}

	/* ---------- Marquee ---------- */
	.marquee {
		overflow: hidden;
		mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
	}
	.marquee-track {
		display: flex;
		width: max-content;
		animation: marquee 38s linear infinite;
	}
	.marquee:hover .marquee-track {
		animation-play-state: paused;
	}
	.marquee-group {
		display: flex;
		gap: 2rem;
		padding-right: 2rem;
	}
	@keyframes marquee {
		to {
			transform: translateX(-50%);
		}
	}

	/* ---------- Cards: a light follows the pointer ---------- */
	.spot::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s;
		background: radial-gradient(
			22rem circle at var(--px, 50%) var(--py, 50%),
			color-mix(in oklab, var(--am-ribbon) 11%, transparent),
			transparent 60%
		);
	}
	.spot:hover::before {
		opacity: 1;
	}
	.decor-bg {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				28rem circle at var(--px, 80%) var(--py, 10%),
				color-mix(in oklab, #e6c473 22%, transparent),
				transparent 60%
			),
			radial-gradient(
				30rem 24rem at 100% 100%,
				color-mix(in oklab, var(--am-ribbon) 45%, transparent),
				transparent 65%
			);
		transition: opacity 0.4s;
	}
	.spot:has(.decor-bg)::before {
		display: none;
	}

	/* ---------- Gifts ---------- */
	.scroller {
		scrollbar-width: none;
		scroll-padding-inline: 1rem;
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.wrapped {
		background:
			linear-gradient(
				90deg,
				transparent 44%,
				color-mix(in oklab, var(--am-ribbon) 26%, transparent) 44% 56%,
				transparent 56%
			),
			linear-gradient(
				0deg,
				transparent 44%,
				color-mix(in oklab, var(--am-ribbon) 26%, transparent) 44% 56%,
				transparent 56%
			),
			var(--secondary);
		transition: transform 0.9s ease;
	}
	.tile:hover .wrapped {
		transform: scale(1.06);
	}
	.link-arrow-text {
		background: linear-gradient(currentColor, currentColor) 0 100% / 0 1.5px no-repeat;
		padding-bottom: 2px;
		transition: background-size 0.4s ease;
	}
	.link-arrow:hover .link-arrow-text {
		background-size: 100% 1.5px;
	}

	/* ---------- Steps ---------- */
	.stars {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(1.5px 1.5px at 12% 22%, #e6c473, transparent),
			radial-gradient(1.5px 1.5px at 78% 14%, #fff, transparent),
			radial-gradient(2px 2px at 90% 70%, #e6c473, transparent),
			radial-gradient(1.5px 1.5px at 30% 84%, #fff, transparent),
			radial-gradient(2px 2px at 56% 46%, #e6c473, transparent),
			radial-gradient(
				40rem 26rem at 0% 0%,
				color-mix(in oklab, var(--am-ribbon) 30%, transparent),
				transparent 70%
			);
		opacity: 0.55;
		animation: tw 6s ease-in-out infinite alternate;
	}
	@keyframes tw {
		to {
			opacity: 0.85;
		}
	}
	.step-line {
		transform-origin: left;
		transition: transform 1.4s cubic-bezier(0.6, 0, 0.2, 1) 0.4s;
	}
	.step:global([data-reveal='pending']) .step-line {
		transform: scaleX(0);
	}

	/* ---------- Packages ---------- */
	.pack-art.tier-basic {
		background:
			radial-gradient(circle at 30% 30%, #bfdcc9, transparent 55%),
			radial-gradient(circle at 75% 70%, #c9dccd, transparent 55%), var(--secondary);
	}
	.pack-art.tier-premium {
		background:
			radial-gradient(circle at 28% 32%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 76% 72%, #f6dc95, transparent 55%), #bfdcc9;
	}
	.pack-art.tier-luxury {
		background:
			radial-gradient(circle at 30% 30%, #3f8a63, transparent 55%),
			radial-gradient(circle at 74% 74%, #d4a23a, transparent 55%), #1d5b3d;
	}
	.pack-art {
		transition: transform 0.9s ease;
	}
	.pack:hover .pack-art {
		transform: scale(1.08);
	}

	/* ---------- School ---------- */
	.seat {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 50%;
		background: radial-gradient(circle at 34% 28%, #2f8a5e, var(--am-ribbon) 60%, #07281a);
		animation: seat-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) calc(var(--i) * 60ms + 0.2s) both;
	}
	@keyframes seat-pop {
		from {
			transform: scale(0);
		}
	}

	/* ---------- Contact ---------- */
	.ribbon-bg {
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
	.ribbon-bg::after {
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
		.marquee-track,
		.glow,
		.stars,
		.ribbon-bg::after,
		.line-in,
		.rise,
		.seat {
			animation: none;
		}
		.marquee-track {
			flex-wrap: wrap;
			width: auto;
			justify-content: center;
		}
	}
</style>
