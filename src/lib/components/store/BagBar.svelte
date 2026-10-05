<script lang="ts">
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { fly } from 'svelte/transition';
	import { m } from '$lib/paraglide/messages.js';
	import { birr } from '$lib/localized';
	import { getBag } from './bag.svelte';

	type Props = { onopen: () => void };
	let { onopen }: Props = $props();

	const bag = getBag();
</script>

<!--
	The one loud thing on the page: the bag, pinned to the bottom edge where a thumb already is.
	It appears when the first gift goes in, and the button inside it is the way to checkout.
-->
{#if bag.count > 0}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 max-sm:bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
		transition:fly={{ y: 80, duration: 220 }}
	>
		<button
			type="button"
			onclick={onopen}
			class="pointer-events-auto mx-auto flex h-14 w-full max-w-xl items-center gap-3 rounded-full bg-[var(--am-ribbon)] pr-2 pl-5 text-left text-white shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--am-ribbon)_70%,transparent)]"
		>
			<ShoppingBag class="h-5 w-5 shrink-0" aria-hidden="true" />
			<span class="flex flex-1 flex-col leading-tight">
				<span class="text-sm opacity-90">{m.bag_count({ count: bag.count })}</span>
				<span class="font-semibold tabular-nums">{birr(bag.total)}</span>
			</span>
			<span class="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--am-ribbon)]">
				{m.bag_open()}
			</span>
		</button>
	</div>
{/if}
