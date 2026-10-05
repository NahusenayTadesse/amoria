<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import InstallButton from '$lib/components/store/InstallButton.svelte';
	import Globe from '@lucide/svelte/icons/globe';
	import { building } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { deLocalizeHref, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	/** The two languages, each labelled in itself so a reader of either can find their own. */
	const languages = [
		{ locale: 'en', label: 'English', short: 'EN' },
		{ locale: 'am', label: 'አማርኛ', short: 'አማ' }
	] as const;

	const current = $derived(getLocale());

	let picker: HTMLDetailsElement | undefined = $state();

	/** On a phone the header slides away while reading down the page and returns on the way back up. */
	let tuckedAway = $state(false);
	let lastY = 0;
	function onScroll() {
		const y = Math.max(0, scrollY);
		if (Math.abs(y - lastY) < 8) return;
		tuckedAway = y > lastY && y > 80;
		lastY = y;
		document.documentElement.style.setProperty(
			'--header-offset',
			tuckedAway ? '0px' : 'calc(3.5rem + env(safe-area-inset-top))'
		);
	}

	/** Close the language menu when the visitor clicks elsewhere or presses Escape. */
	function dismiss(event: Event) {
		if (!picker?.open) return;
		if (
			event instanceof KeyboardEvent
				? event.key === 'Escape'
				: !picker.contains(event.target as Node)
		)
			picker.open = false;
	}

	/** Prerendered pages have no query string to keep, and reading it there is an error. */
	const search = $derived(building ? '' : page.url.search);

	const links = [
		{ to: '/shop', label: m.nav_shop, desktopOnly: false },
		{ to: '/school', label: m.nav_school, desktopOnly: false },
		{ to: '/about', label: m.nav_about, desktopOnly: true },
		{ to: '/contact', label: m.nav_contact, desktopOnly: false }
	];

	/** Whether the visitor is on this link's page, in either language (`/am/about` is `/about`). */
	const isCurrent = (to: string) => deLocalizeHref(page.url.pathname).startsWith(to);
</script>

<svelte:window onclick={dismiss} onkeydown={dismiss} onscroll={onScroll} />

<header
	class={[
		'site-header sticky top-0 z-30 border-b border-white/10 bg-[var(--am-ink)] pt-[env(safe-area-inset-top)] text-white transition-transform duration-300',
		tuckedAway && 'max-sm:-translate-y-full'
	]}
>
	<div
		class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 max-sm:justify-center sm:h-20 sm:px-8"
	>
		<a
			href={resolve(localizeHref('/') as AppPath)}
			class="flex h-full items-center"
			aria-label={m.site_name()}
		>
			<img src="/brand/logo.png" alt="" class="h-11 w-auto sm:h-16" width="432" height="344" />
		</a>

		<nav aria-label={m.nav_shop()} class="ml-auto flex items-center gap-0.5 text-sm max-sm:hidden">
			{#each links as link (link.to)}
				<a
					href={resolve(localizeHref(link.to) as AppPath)}
					aria-current={isCurrent(link.to) ? 'page' : undefined}
					class={[
						'rounded-full px-3 py-2.5 font-medium text-white/90 hover:bg-white/10 aria-[current=page]:bg-white/15 aria-[current=page]:text-[var(--am-gold)]',
						link.desktopOnly && 'max-sm:hidden'
					]}
				>
					{link.label()}
				</a>
			{/each}
		</nav>

		<InstallButton compact class="max-sm:hidden sm:ml-0" />

		<!-- A dropdown, so the language choice reads as a setting rather than as one more page link. -->
		<details bind:this={picker} class="group relative max-sm:hidden">
			<summary
				aria-label={m.nav_language()}
				class="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-white/25 px-3 text-sm font-medium text-white hover:border-[var(--am-gold)] hover:text-[var(--am-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--am-gold)] [&::-webkit-details-marker]:hidden"
			>
				<Globe class="h-4 w-4" aria-hidden="true" />
				<span lang={current}>{languages.find((l) => l.locale === current)?.short}</span>
				<ChevronDown
					class="h-3.5 w-3.5 transition-transform group-open:rotate-180"
					aria-hidden="true"
				/>
			</summary>
			<ul
				class="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
			>
				{#each languages as language (language.locale)}
					<li>
						<a
							href={resolve(
								localizeHref(page.url.pathname + search, {
									locale: language.locale
								}) as AppPath
							)}
							hreflang={language.locale}
							lang={language.locale}
							aria-current={current === language.locale ? 'true' : undefined}
							data-sveltekit-reload
							class="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-secondary aria-[current=true]:font-semibold"
						>
							{language.label}
							{#if current === language.locale}
								<Check class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</details>
	</div>
</header>
