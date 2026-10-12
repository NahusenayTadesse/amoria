<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Check from '@lucide/svelte/icons/check';
	import Phone from '@lucide/svelte/icons/phone';
	import Ruler from '@lucide/svelte/icons/ruler';
	import Users from '@lucide/svelte/icons/users';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { setKitLabels } from '@nahu/admin-kit/labels';
	import YouTubeEmbed from '@nahu/admin-kit/components/YouTubeEmbed.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { birr, localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import { chatHref, telHref } from '$lib/chat';
	import Gallery from '$lib/components/store/Gallery.svelte';

	let { data } = $props();

	// The kit's player speaks the visitor's language.
	setKitLabels(() => ({
		youtubePlay: (title) => m.video_play({ title }),
		youtubeWatch: m.video_watch()
	}));

	const space = $derived(data.space);
	const name = $derived(localized(space, 'name'));
	const summary = $derived(localized(space, 'summary'));
	const description = $derived(localized(space, 'description'));
	const unit = $derived(localized(space, 'priceUnit'));
	const features = $derived(
		getLocale() === 'am' && space.featuresAm.length ? space.featuresAm : space.features
	);
	const images = $derived(
		space.images.map((image) => ({
			id: image.id,
			fileName: image.fileName,
			alt: localized({ alt: image.alt, altAm: image.altAm }, 'alt') || name
		}))
	);
	const cover = $derived(images[0]);
	const ask = $derived(chatHref(data.contact, m.chat_space({ name })));
	const call = $derived(telHref(data.contact.phone ?? ''));
	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	const metaDescription = $derived(summary || m.spaces_space_meta_description({ name }));

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'EventVenue',
					name,
					description: metaDescription,
					...(space.capacity ? { maximumAttendeeCapacity: space.capacity } : {}),
					...(cover ? { image: `${page.url.origin}${publicFileUrl(cover.fileName)}` } : {})
				},
				{
					'@type': 'BreadcrumbList',
					itemListElement: [
						{ '@type': 'ListItem', position: 1, name: 'Amoria', item: page.url.origin },
						{
							'@type': 'ListItem',
							position: 2,
							name: m.spaces_kicker(),
							item: `${page.url.origin}${path('/spaces')}`
						},
						{ '@type': 'ListItem', position: 3, name }
					]
				}
			]
		}).replace(/</g, '\\u003c')
	);
	const ldTag = $derived(`<script type="application/ld+json">${jsonLd}<${'/'}script>`);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external chat and phone links -->
<svelte:head>
	<title>{m.spaces_space_meta_title({ name })}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content={m.spaces_space_meta_title({ name })} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="website" />
	{#if cover}
		<meta property="og:image" content={`${page.url.origin}${publicFileUrl(cover.fileName)}`} />
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ldTag}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pt-12 sm:pb-28">
	<a
		href={path('/spaces')}
		class="rise group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
		style="--i: 0"
	>
		<ArrowLeft
			class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
			aria-hidden="true"
		/>
		{m.spaces_back()}
	</a>

	<div class="mt-6 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
		<div class="rise" style="--i: 1">
			<div class="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-secondary">
				{#if cover}
					<img
						src={publicFileUrl(cover.fileName)}
						alt={cover.alt}
						width="960"
						height="720"
						fetchpriority="high"
						class="absolute inset-0 h-full w-full object-cover"
					/>
				{:else}
					<div class="space-art absolute inset-0 grid place-items-center" aria-hidden="true">
						<Building2 class="h-24 w-24 text-white/90" />
					</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-col">
			<p
				class="rise text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase"
				style="--i: 1"
			>
				{m.spaces_kicker()}
			</p>
			<h1 class="display mt-3 text-4xl leading-[1.05] font-bold sm:text-5xl">
				<span class="line"><span class="line-in" style="--i: 2">{name}</span></span>
			</h1>
			{#if summary}
				<p class="rise mt-5 max-w-[52ch] text-base text-muted-foreground sm:text-lg" style="--i: 3">
					{summary}
				</p>
			{/if}

			<div class="rise mt-7 flex flex-wrap gap-x-10 gap-y-4" style="--i: 4">
				<div>
					<p class="display text-3xl font-bold tabular-nums">
						{space.price != null
							? m.spaces_price_from({ price: birr(space.price) })
							: m.spaces_price_ask()}
					</p>
					{#if space.price != null && unit}
						<p class="text-xs text-muted-foreground">{unit}</p>
					{/if}
				</div>
				{#if space.capacity}
					<div class="flex items-center gap-2 self-center text-base font-semibold">
						<Users class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
						{m.spaces_capacity({ count: space.capacity })}
					</div>
				{/if}
				{#if space.sizeText}
					<div class="flex items-center gap-2 self-center text-base font-semibold">
						<Ruler class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
						{space.sizeText}
					</div>
				{/if}
			</div>

			<p class="rise mt-6 max-w-[52ch] text-sm text-muted-foreground" style="--i: 5">
				{m.spaces_book_note()}
			</p>
			<div class="rise mt-5 flex flex-wrap items-center gap-3" style="--i: 5">
				<a
					href={ask ?? path('/contact')}
					target={ask ? '_blank' : undefined}
					rel={ask ? 'noopener noreferrer' : undefined}
					class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
				>
					{m.spaces_book()}
					<ArrowRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</a>
				{#if call}
					<a
						href={call}
						class="inline-flex h-13 items-center gap-2 rounded-full border border-foreground/30 px-7 text-[0.95rem] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground"
					>
						<Phone class="h-4 w-4" aria-hidden="true" />
						{m.spaces_call()}
					</a>
				{/if}
			</div>
		</div>
	</div>

	{#if space.youtubeUrl}
		<section class="mt-20 sm:mt-28" aria-labelledby="space-video">
			<h2 id="space-video" use:reveal class="display text-3xl font-bold sm:text-4xl">
				{m.spaces_video()}
			</h2>
			<div use:reveal class="mt-8 max-w-4xl overflow-hidden rounded-[1.5rem]">
				<YouTubeEmbed url={space.youtubeUrl} title={name} class="rounded-none" />
			</div>
		</section>
	{/if}

	{#if description || features.length}
		<section class="mt-20 grid gap-12 sm:mt-28 lg:grid-cols-2">
			{#if description}
				<div use:reveal>
					<h2 class="display text-3xl font-bold sm:text-4xl">{m.spaces_about()}</h2>
					<p
						class="mt-6 max-w-[60ch] text-base whitespace-pre-line text-muted-foreground sm:text-lg"
					>
						{description}
					</p>
				</div>
			{/if}
			{#if features.length}
				<div use:reveal>
					<h2 class="display text-3xl font-bold sm:text-4xl">{m.spaces_features()}</h2>
					<ul class="mt-6 flex flex-col gap-3">
						{#each features as feature, index (index)}
							<li class="flex items-start gap-3 text-base sm:text-lg">
								<span
									class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--am-ribbon)] text-white"
								>
									<Check class="h-4 w-4" aria-hidden="true" />
								</span>
								{feature}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	{#if images.length > 1}
		<section class="mt-20 sm:mt-28" aria-labelledby="space-gallery">
			<h2 id="space-gallery" use:reveal class="display text-3xl font-bold sm:text-4xl">
				{m.spaces_gallery()}
			</h2>
			<div class="mt-8">
				<Gallery {images} label={m.spaces_gallery()} />
			</div>
		</section>
	{/if}
</div>

<style>
	.space-art {
		background:
			radial-gradient(circle at 25% 30%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 78% 72%, #d4a23a, transparent 55%), #1d5b3d;
	}
</style>
