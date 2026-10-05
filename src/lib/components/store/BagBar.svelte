<script lang="ts">
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { bagCount } from '$lib/bagCount.svelte';

	onMount(() => bagCount.start());
</script>

<!--
	The floating bag, on every store page: always in reach at the bottom right, with the count on
	it. It reads the saved bag (the bag itself only exists on the shop page) and opens checkout
	through `/shop?bag=1`. `data-bag-target` is where a gift lands when it is added (`flyToBag`).
-->
<div
	class="pointer-events-none fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 sm:right-6 sm:bottom-6"
>
	<a
		href={resolve(localizeHref('/shop?bag=1') as AppPath)}
		data-sveltekit-noscroll
		data-bag-target
		aria-label={bagCount.n > 0 ? m.bag_count({ count: bagCount.n }) : m.nav_bag()}
		class="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full bg-[var(--am-ribbon)] text-white shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--am-ribbon)_70%,transparent)] active:scale-95"
	>
		<ShoppingBag class="h-6 w-6" aria-hidden="true" />
		{#if bagCount.n > 0}
			<span
				class="absolute -top-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-[var(--am-ribbon)] tabular-nums shadow"
				aria-hidden="true"
			>
				{bagCount.n}
			</span>
		{/if}
	</a>
</div>
