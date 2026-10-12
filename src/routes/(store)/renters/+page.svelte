<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import RenterCard from '$lib/components/store/RenterCard.svelte';
	import JoinRentersBanner from '$lib/components/store/JoinRentersBanner.svelte';
	import { reveal } from '$lib/actions/reveal';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.renters_meta_title()}</title>
	<meta name="description" content={m.renters_meta_description()} />
	<meta property="og:title" content={m.renters_meta_title()} />
	<meta property="og:description" content={m.renters_meta_description()} />
</svelte:head>

<PageHero
	kicker={m.renters_kicker()}
	before={m.renters_h1_a()}
	accent={m.renters_h1_b()}
	after={m.renters_h1_c()}
	lede={m.renters_lede()}
/>

<section class="mx-auto max-w-6xl px-4 pb-20 sm:px-8 sm:pb-28" aria-label={m.renters_kicker()}>
	{#if data.renters.length}
		<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.renters as renter, index (renter.id)}
				<li use:reveal style="--i: {index % 3}"><RenterCard {renter} eager={index < 3} /></li>
			{/each}
		</ul>
	{:else}
		<p class="max-w-md rounded-[var(--radius)] bg-secondary p-6 text-muted-foreground">
			{m.renters_empty()}
		</p>
	{/if}
	<div class="mt-20"><JoinRentersBanner /></div>
</section>
