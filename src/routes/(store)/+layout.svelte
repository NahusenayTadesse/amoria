<script lang="ts">
	import { Toaster } from 'svelte-sonner';
	import '$lib/components/store/fonts.css';
	import '$lib/components/store/store.css';
	import SiteHeader from '$lib/components/store/SiteHeader.svelte';
	import BagBar from '$lib/components/store/BagBar.svelte';
	import TabBar from '$lib/components/store/TabBar.svelte';
	import OfflineBanner from '$lib/components/store/OfflineBanner.svelte';
	import InstallButton from '$lib/components/store/InstallButton.svelte';
	import InstallBanner from '$lib/components/store/InstallBanner.svelte';
	import MoreSheet from '$lib/components/store/MoreSheet.svelte';
	import NavProgress from '$lib/components/store/NavProgress.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { flushQueue } from '$lib/offlineQueue';
	import { resolve } from '$app/paths';
	import { responsive } from '$lib/img';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { deLocalizeHref, localizeHref } from '$lib/paraglide/runtime';

	let { children } = $props();

	/** Anything saved offline (a quote request) goes out now and whenever the connection returns. */
	onMount(() => {
		void flushQueue();
		const retry = () => void flushQueue();
		addEventListener('online', retry);
		return () => removeEventListener('online', retry);
	});

	/** The registration form pins its own pay button to the bottom, so the tab bar steps aside. */
	const tabsHidden = $derived(/^\/school\/[^/]+\/register/.test(deLocalizeHref(page.url.pathname)));

	const sign = responsive('/images/shop/sign-am.webp', 640, 1280);

	/** Page changes cross-fade where the browser can, so moving about feels like an app, not a reload. */
	onNavigate((navigation) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	const links = [
		{ to: '/', label: m.nav_home },
		{ to: '/shop', label: m.nav_shop },
		{ to: '/school', label: m.nav_school },
		{ to: '/about', label: m.nav_about },
		{ to: '/contact', label: m.nav_contact }
	];
</script>

<svelte:head>
	<link
		rel="preload"
		href="/fonts/noto-sans-latin-o-0bIpQl.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href="/fonts/bricolage-grotesque-latin-3y9K6as8.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

<div
	data-site-type
	class={[
		'store flex min-h-dvh flex-col',
		!tabsHidden && 'max-sm:pb-[calc(4rem+env(safe-area-inset-bottom))]'
	]}
>
	<NavProgress />
	<SiteHeader />
	<OfflineBanner />
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="bg-[var(--am-ink)] px-4 py-8 text-sm text-white/70 sm:px-8 sm:py-10">
		<img
			src={sign.src}
			srcset={sign.srcset}
			sizes="(min-width: 896px) 896px, 92vw"
			alt={m.photo_sign_alt()}
			width="1280"
			height="265"
			loading="lazy"
			decoding="async"
			class="mx-auto mb-10 w-full max-w-4xl rounded-xl max-sm:hidden"
		/>
		<div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8">
			<div class="flex flex-col gap-1">
				<img
					src="/brand/logo.png"
					alt={m.site_name()}
					class="mb-2 h-14 w-auto self-start sm:h-20"
					width="432"
					height="344"
				/>
				<p>{m.footer_place()}</p>
				<p>{m.footer_pickup()}</p>
			</div>
			<nav aria-label={m.footer_explore()} class="flex flex-wrap gap-x-6 gap-y-2 max-sm:hidden">
				{#each links as link (link.to)}
					<a
						href={resolve(localizeHref(link.to) as AppPath)}
						class="py-2 font-medium text-white hover:text-[var(--am-gold)]"
					>
						{link.label()}
					</a>
				{/each}
			</nav>
			<InstallButton class="max-sm:hidden" />
		</div>
	</footer>
	{#if !tabsHidden}<BagBar /><TabBar />{/if}
	<MoreSheet />
	<InstallBanner />
</div>

<Toaster position="top-center" richColors />
