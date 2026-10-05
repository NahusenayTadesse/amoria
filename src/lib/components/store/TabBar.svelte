<!--
	The phone's bottom tab bar: Home, Shop, School, the Bag (with its count) and More. Shown on
	small screens only; wider ones keep the header's links. "More" opens a sheet with everything
	else, so the bar stays five items long.
-->
<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Gift from '@lucide/svelte/icons/gift';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import House from '@lucide/svelte/icons/house';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { deLocalizeHref, localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { bagCount } from '$lib/bagCount.svelte';

	const link = [
		{ to: '/', label: m.nav_home, Icon: House },
		{ to: '/shop', label: m.nav_shop, Icon: Gift },
		{ to: '/school', label: m.nav_school, Icon: GraduationCap }
	];

	const here = $derived(deLocalizeHref(page.url.pathname));
	const isCurrent = (to: string) => (to === '/' ? here === '/' : here.startsWith(to));
	const moreOpen = $derived(page.state.sheet === 'more');

	onMount(() => bagCount.start());

	/** The bag's count on the installed app's icon, where the browser supports it. */
	$effect(() => {
		const nav = navigator as Navigator & {
			setAppBadge?: (n?: number) => Promise<void>;
			clearAppBadge?: () => Promise<void>;
		};
		if (bagCount.n > 0) nav.setAppBadge?.(bagCount.n)?.catch(() => undefined);
		else nav.clearAppBadge?.()?.catch(() => undefined);
	});

	const tab =
		'relative flex h-full w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-white/65 transition-colors active:bg-white/10 aria-[current=page]:text-[var(--am-gold)]';
</script>

<nav
	aria-label={m.nav_main()}
	class="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--am-ink)] pb-[env(safe-area-inset-bottom)] sm:hidden"
>
	<ul class="grid h-16 grid-cols-5">
		{#each link as { to, label, Icon } (to)}
			<li>
				<a
					href={resolve(localizeHref(to) as AppPath)}
					aria-current={isCurrent(to) ? 'page' : undefined}
					class={tab}
				>
					<Icon class="h-5 w-5" aria-hidden="true" />
					{label()}
				</a>
			</li>
		{/each}
		<li>
			<a href={resolve(localizeHref('/shop?bag=1') as AppPath)} class={tab} data-sveltekit-noscroll>
				<span class="relative">
					<ShoppingBag class="h-5 w-5" aria-hidden="true" />
					{#if bagCount.n > 0}
						<span
							class="absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full bg-[var(--am-gold)] px-1 text-[0.65rem] leading-4 font-bold text-[var(--am-ink)]"
						>
							<span class="sr-only">{m.bag_count({ count: bagCount.n })}</span>
							<span aria-hidden="true">{bagCount.n}</span>
						</span>
					{/if}
				</span>
				{m.nav_bag()}
			</a>
		</li>
		<li>
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={moreOpen}
				onclick={() => pushState('', { sheet: 'more' })}
				class={tab}
				aria-current={moreOpen ? 'page' : undefined}
			>
				<Ellipsis class="h-5 w-5" aria-hidden="true" />
				{m.nav_more()}
			</button>
		</li>
	</ul>
</nav>
