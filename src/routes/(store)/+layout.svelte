<script lang="ts">
	import { Toaster } from 'svelte-sonner';
	import '$lib/components/store/store.css';
	import SiteHeader from '$lib/components/store/SiteHeader.svelte';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';

	let { children } = $props();

	const links = [
		{ to: '/', label: m.nav_home },
		{ to: '/shop', label: m.nav_shop },
		{ to: '/school', label: m.nav_school },
		{ to: '/about', label: m.nav_about },
		{ to: '/contact', label: m.nav_contact }
	];
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<!-- TODO(§13): self-host and subset these, the Ethiopic face above all. -->
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Fraunces:ital,opsz,wght@1,9..144,400&family=Noto+Sans+Ethiopic:wght@400;600&family=Noto+Sans:wght@400;500;600&display=swap"
	/>
</svelte:head>

<div class="store flex min-h-dvh flex-col">
	<SiteHeader />
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="border-t border-border px-4 py-10 text-sm text-muted-foreground sm:px-8">
		<div class="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8">
			<div class="flex flex-col gap-1">
				<p class="display text-lg font-bold text-foreground">{m.site_name()}</p>
				<p>{m.footer_place()}</p>
				<p>{m.footer_pickup()}</p>
			</div>
			<nav aria-label={m.footer_explore()} class="flex flex-wrap gap-x-6 gap-y-2">
				{#each links as link (link.to)}
					<a
						href={resolve(localizeHref(link.to) as AppPath)}
						class="py-2 font-medium text-foreground hover:text-[var(--am-ribbon)]"
					>
						{link.label()}
					</a>
				{/each}
			</nav>
		</div>
	</footer>
</div>

<Toaster position="top-center" richColors />
