<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { reveal } from '$lib/actions/reveal';
	import { chatHref } from '$lib/chat';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import PhotoArt from '$lib/components/store/PhotoArt.svelte';
	import SpaceCard from '$lib/components/store/SpaceCard.svelte';

	let { data } = $props();

	const ask = $derived(chatHref(data.contact, m.chat_spaces()));
	const contact = $derived(resolve(localizeHref('/contact') as AppPath));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- an external chat link and #anchors -->
<svelte:head>
	<title>{m.spaces_meta_title()}</title>
	<meta name="description" content={m.spaces_meta_description()} />
	<meta property="og:title" content={m.spaces_meta_title()} />
	<meta property="og:description" content={m.spaces_meta_description()} />
	<meta property="og:type" content="website" />
</svelte:head>

<PageHero
	kicker={m.spaces_kicker()}
	before={m.spaces_h1_a()}
	accent={m.spaces_h1_b()}
	after={m.spaces_h1_c()}
	lede={m.spaces_lede()}
>
	{#snippet actions()}
		<a
			href="#spaces"
			class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
		>
			{m.spaces_list_heading()}
			<ArrowRight
				class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
				aria-hidden="true"
			/>
		</a>
	{/snippet}
	{#snippet art()}
		<PhotoArt
			main={{ src: '/images/demo/gallery-evening-hall.webp', w: 900, h: 600, small: 480 }}
			side={{ src: '/images/demo/gallery-hall-drapes.webp', w: 900, h: 599, small: 480 }}
		/>
	{/snippet}
</PageHero>

<section id="spaces" class="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-8 sm:pb-28">
	<div use:reveal class="max-w-2xl">
		<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
			{m.spaces_list_kicker()}
		</p>
		<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
			{m.spaces_list_heading()}
		</h2>
	</div>

	{#if data.spaces.length}
		<ul class="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2 lg:grid-cols-3">
			{#each data.spaces as space, index (space.id)}
				<li use:reveal style="--i: {index % 3}">
					<SpaceCard {space} eager={index < 3} />
				</li>
			{/each}
		</ul>
	{:else}
		<div use:reveal class="mt-10 max-w-xl rounded-[1.5rem] bg-secondary p-7 sm:p-9">
			<p class="display text-xl font-bold sm:text-2xl">{m.spaces_empty()}</p>
			<a
				href={ask ?? contact}
				target={ask ? '_blank' : undefined}
				rel={ask ? 'noopener noreferrer' : undefined}
				class="btn-shine group mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-6 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
			>
				{m.spaces_book()}
				<ArrowRight
					class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				/>
			</a>
		</div>
	{/if}
</section>
