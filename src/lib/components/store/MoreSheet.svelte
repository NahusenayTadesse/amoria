<!--
	The tab bar's "More": a bottom sheet with what does not earn a tab: About, Contact, the
	language, and installing the app. Its open state is the page's shallow-routing state, so the
	Back button (or a swipe back) closes it.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Info from '@lucide/svelte/icons/info';
	import Phone from '@lucide/svelte/icons/phone';
	import * as Sheet from '@nahu/admin-kit/components/ui/sheet/index.js';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import InstallButton from './InstallButton.svelte';

	const languages = [
		{ locale: 'en', label: 'English' },
		{ locale: 'am', label: 'አማርኛ' }
	] as const;

	const open = $derived(page.state.sheet === 'more');
	const current = $derived(getLocale());

	function onOpenChange(next: boolean) {
		if (!next && open) history.back();
	}

	const row =
		'flex h-14 items-center justify-between gap-3 rounded-xl px-3 text-base font-medium active:bg-secondary';
</script>

<Sheet.Root {open} {onOpenChange}>
	<Sheet.Content
		data-site-type
		side="bottom"
		class="store max-h-[85dvh] gap-0 rounded-t-[1.25rem] p-0 sm:hidden"
	>
		<Sheet.Header class="px-5 pt-5 pb-2 text-left">
			<Sheet.Title class="display text-xl font-bold">{m.more_title()}</Sheet.Title>
			<Sheet.Description class="sr-only">{m.more_title()}</Sheet.Description>
		</Sheet.Header>

		<div class="grid gap-1 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
			<a href={resolve(localizeHref('/about') as AppPath)} class={row}>
				<span class="flex items-center gap-3">
					<Info class="h-5 w-5 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.nav_about()}
				</span>
				<ChevronRight class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
			</a>
			<a href={resolve(localizeHref('/contact') as AppPath)} class={row}>
				<span class="flex items-center gap-3">
					<Phone class="h-5 w-5 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.nav_contact()}
				</span>
				<ChevronRight class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
			</a>

			<div class="mt-3 px-3">
				<p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
					{m.more_language()}
				</p>
				<div class="mt-2 grid grid-cols-2 gap-2">
					{#each languages as language (language.locale)}
						<a
							href={resolve(
								localizeHref(page.url.pathname + page.url.search, {
									locale: language.locale
								}) as AppPath
							)}
							hreflang={language.locale}
							lang={language.locale}
							aria-current={current === language.locale ? 'true' : undefined}
							data-sveltekit-reload
							class="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium active:bg-secondary aria-[current=true]:border-[var(--am-ribbon)] aria-[current=true]:font-semibold"
						>
							{#if current === language.locale}
								<Check class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
							{/if}
							{language.label}
						</a>
					{/each}
				</div>
			</div>

			<div class="mt-3 px-3">
				<InstallButton tone="light" class="w-full justify-center" />
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>
