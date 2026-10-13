<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Flower2 from '@lucide/svelte/icons/flower-2';
	import Frame from '@lucide/svelte/icons/frame';
	import Palette from '@lucide/svelte/icons/palette';
	import PartyPopper from '@lucide/svelte/icons/party-popper';
	import Truck from '@lucide/svelte/icons/truck';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import { asset, resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import { eventTypeImage } from '$lib/eventTypeImages';
	import ChatButtons from '$lib/components/store/ChatButtons.svelte';
	import PackageCard from '$lib/components/store/PackageCard.svelte';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import PhotoArt from '$lib/components/store/PhotoArt.svelte';

	let { data } = $props();

	const quote = (query = '') =>
		`${resolve(localizeHref('/decor/quote') as AppPath)}${query}#quote-form`;

	const included = [
		{ title: m.decor_inc_design, body: m.decor_inc_design_body, Icon: Palette },
		{ title: m.decor_inc_backdrop, body: m.decor_inc_backdrop_body, Icon: Frame },
		{ title: m.decor_inc_flowers, body: m.decor_inc_flowers_body, Icon: Flower2 },
		{ title: m.decor_inc_tables, body: m.decor_inc_tables_body, Icon: UtensilsCrossed },
		{ title: m.decor_inc_balloons, body: m.decor_inc_balloons_body, Icon: PartyPopper },
		{ title: m.decor_inc_setup, body: m.decor_inc_setup_body, Icon: Truck }
	];

	const steps = [
		{ title: m.home_step_1_title, body: m.home_step_1_body },
		{ title: m.home_step_2_title, body: m.home_step_2_body },
		{ title: m.home_step_3_title, body: m.home_step_3_body }
	];

	/** The kinds of event that have packages, for the filter above them; `null` is all of them. */
	let kind = $state<number | null>(null);
	const kinds = $derived(
		data.events.filter((event) => data.packages.some((pack) => pack.eventTypeId === event.id))
	);
	const shown = $derived(
		kind == null ? data.packages : data.packages.filter((pack) => pack.eventTypeId === kind)
	);

	const hasChat = $derived(!!(data.contact.whatsapp.trim() || data.contact.telegram.trim()));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- quote links are resolved above, then given a query and #anchor -->
<svelte:head>
	<title>{m.decor_meta_title()}</title>
	<meta name="description" content={m.decor_meta_description()} />
	<meta property="og:title" content={m.decor_meta_title()} />
	<meta property="og:description" content={m.decor_meta_description()} />
	<meta property="og:type" content="website" />
</svelte:head>

<PageHero
	kicker={m.decor_kicker()}
	before={m.decor_h1_a()}
	accent={m.decor_h1_b()}
	after={m.decor_h1_c()}
	lede={m.decor_lede()}
>
	{#snippet actions()}
		<a
			href={quote()}
			class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
		>
			{m.home_cta_plan()}
			<ArrowRight
				class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
				aria-hidden="true"
			/>
		</a>
		{#if data.packages.length}
			<a
				href="#packages"
				class="inline-flex h-13 items-center rounded-full border border-foreground/30 px-7 text-[0.95rem] font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
			>
				{m.decor_see_packages()}
			</a>
		{/if}
	{/snippet}
	{#snippet art()}
		<PhotoArt
			main={{ src: '/images/demo/gallery-ceremony-chairs.webp', w: 900, h: 1350, small: 480 }}
			side={{ src: '/images/demo/gallery-centerpiece.webp', w: 900, h: 1440, small: 480 }}
		/>
	{/snippet}
</PageHero>

<!-- ============================== What we decorate ============================== -->
{#if data.events.length}
	<section class="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pt-12 sm:pb-28">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
				{m.decor_events_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.decor_events_heading()}
			</h2>
		</div>
		<ul class="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-5 lg:grid-cols-3">
			{#each data.events as event, index (event.id)}
				{@const name = localized(event, 'name')}
				<li use:reveal style="--i: {index % 3}">
					<a
						href={quote(`?type=${encodeURIComponent(event.slug)}`)}
						class="group relative block aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-secondary"
					>
						<img
							src={asset(eventTypeImage(event.slug))}
							alt=""
							loading="lazy"
							decoding="async"
							width="480"
							height="360"
							class="h-full w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]"
						/>
						<span
							class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[var(--am-ink)]/85 via-[var(--am-ink)]/20 to-transparent p-4 text-white sm:p-5"
						>
							<span class="display text-lg leading-tight font-bold sm:text-2xl">{name}</span>
							<span
								class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#f1d795] sm:text-sm"
							>
								{m.decor_events_quote()}
								<ArrowUpRight
									class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
									aria-hidden="true"
								/>
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- ============================== What's included ============================== -->
<section class="bg-card py-16 sm:py-28">
	<div class="mx-auto max-w-6xl px-4 sm:px-8">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
				{m.decor_included_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.decor_included_heading()}
			</h2>
		</div>
		<ul class="mt-10 grid gap-x-8 gap-y-10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
			{#each included as item, index (index)}
				<li use:reveal style="--i: {index % 3}" class="flex gap-4">
					<span
						class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-[var(--am-ribbon)]"
					>
						<item.Icon class="h-6 w-6" aria-hidden="true" />
					</span>
					<div>
						<h3 class="display text-lg font-bold">{item.title()}</h3>
						<p class="mt-1 text-[0.95rem] text-muted-foreground">{item.body()}</p>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- ============================== How it works ============================== -->
<section class="relative isolate overflow-hidden bg-[var(--am-ink)] py-16 text-white sm:py-28">
	<img
		src={asset('/images/demo/gallery-evening-hall-480.webp')}
		alt=""
		width="900"
		height="600"
		loading="lazy"
		decoding="async"
		class="absolute inset-0 -z-10 h-full w-full object-cover opacity-20"
	/>
	<div class="mx-auto max-w-6xl px-4 sm:px-8">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[#e6c473] uppercase">
				{m.home_steps_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.home_steps_heading()}
			</h2>
		</div>
		<ol class="mt-10 grid gap-8 sm:mt-16 md:grid-cols-3">
			{#each steps as step, index (index)}
				<li use:reveal style="--i: {index + 1}">
					<span class="accent text-6xl text-[#e6c473] sm:text-7xl">{index + 1}</span>
					<h3 class="display mt-4 text-xl font-bold sm:text-2xl">{step.title()}</h3>
					<p class="mt-2 max-w-[34ch] text-[0.95rem] text-white/70">{step.body()}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

<!-- ============================== Packages ============================== -->
<section id="packages" class="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-8 sm:py-28">
	<div use:reveal class="max-w-2xl">
		<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
			{m.home_packages_kicker()}
		</p>
		<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
			{m.decor_packages_heading()}
		</h2>
		<p class="mt-4 text-muted-foreground">{m.decor_packages_lede()}</p>
	</div>

	{#if data.packages.length}
		{#if kinds.length > 1}
			<div class="mt-8 flex flex-wrap gap-2" role="group" aria-label={m.quote_event_type()}>
				{#each [{ id: null, label: m.decor_packages_all() }, ...kinds.map( (event) => ({ id: event.id, label: localized(event, 'name') }) )] as option (option.id ?? 'all')}
					<button
						type="button"
						aria-pressed={kind === option.id}
						onclick={() => (kind = option.id)}
						class="h-10 rounded-full border px-4 text-sm font-semibold transition-colors aria-pressed:border-[var(--am-ribbon)] aria-pressed:bg-[var(--am-ribbon)] aria-pressed:text-white aria-[pressed=false]:border-border aria-[pressed=false]:hover:border-foreground/40"
					>
						{option.label}
					</button>
				{/each}
			</div>
		{/if}
		<div class="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
			{#each shown as pack, index (pack.id)}
				<PackageCard {pack} index={index % 3} />
			{/each}
		</div>
	{:else}
		<p class="mt-8 max-w-[56ch] text-muted-foreground">{m.decor_packages_none()}</p>
	{/if}
</section>

<!-- ============================== Our work ============================== -->
{#if data.portfolio.length}
	<section class="bg-card py-16 sm:py-28">
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
					<li use:reveal style="--i: {index % 3}">
						<figure class="group relative overflow-hidden rounded-[1.25rem] bg-secondary">
							<img
								src={publicFileUrl(item.image)}
								alt={item.imageAlt ?? title}
								loading="lazy"
								decoding="async"
								width="800"
								height="800"
								class="aspect-square w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]"
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

<!-- ============================== Closing ============================== -->
<section class="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
	<div
		use:reveal
		class="relative isolate overflow-hidden rounded-[2rem] bg-[var(--am-ink)] px-6 py-12 text-white sm:px-14 sm:py-16"
	>
		<img
			src={asset('/images/demo/gallery-hall-drapes-480.webp')}
			alt=""
			width="900"
			height="599"
			loading="lazy"
			decoding="async"
			class="absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
		/>
		<h2 class="display max-w-[20ch] text-3xl leading-[1.08] font-bold sm:text-5xl">
			{m.decor_cta_heading()}
		</h2>
		<p class="mt-4 max-w-[48ch] text-white/75">{m.decor_cta_body()}</p>
		<div class="mt-8 flex flex-wrap items-center gap-3">
			<a
				href={quote()}
				class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[#e6c473] px-7 text-[0.95rem] font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
			>
				{m.home_cta_plan()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				/>
			</a>
			{#if hasChat}
				<ChatButtons
					whatsapp={data.contact.whatsapp}
					telegram={data.contact.telegram}
					text={m.chat_decor()}
					tone="light"
				/>
			{/if}
		</div>
	</div>
</section>
