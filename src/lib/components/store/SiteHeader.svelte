<script lang="ts">
	import { building } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { deLocalizeHref, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	/** The two languages, each labelled in itself so a reader of either can find their own. */
	const languages = [
		{ locale: 'en', label: 'English' },
		{ locale: 'am', label: 'አማርኛ' }
	] as const;

	const current = $derived(getLocale());

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

<header
	class="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
>
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
		<a
			href={resolve(localizeHref('/') as AppPath)}
			class="display text-2xl font-bold text-foreground"
		>
			{m.site_name()}
		</a>

		<nav aria-label={m.nav_shop()} class="ml-auto flex items-center gap-0.5 text-sm">
			{#each links as link (link.to)}
				<a
					href={resolve(localizeHref(link.to) as AppPath)}
					aria-current={isCurrent(link.to) ? 'page' : undefined}
					class={[
						'rounded-full px-3 py-2 font-medium text-foreground hover:bg-secondary aria-[current=page]:bg-secondary',
						link.desktopOnly && 'max-sm:hidden'
					]}
				>
					{link.label()}
				</a>
			{/each}
		</nav>

		<nav aria-label={m.nav_language()} class="flex items-center gap-1 text-sm">
			{#each languages as language (language.locale)}
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
					class={[
						'rounded-full px-3 py-2',
						current === language.locale
							? 'bg-secondary font-semibold text-foreground'
							: 'text-muted-foreground hover:text-foreground'
					]}
				>
					{language.label}
				</a>
			{/each}
		</nav>
	</div>
</header>
