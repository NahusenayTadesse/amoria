<script lang="ts">
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { m } from '$lib/paraglide/messages.js';

	// Prerendered once and cached, so it carries both languages rather than the visitor's.
	const both = [{ locale: 'en' as const }, { locale: 'am' as const }];
</script>

<svelte:head>
	<title>{m.offline_title({}, { locale: 'en' })} | Amoria</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto grid max-w-xl place-items-center px-4 py-24 text-center sm:py-32">
	<WifiOff class="h-12 w-12 text-[var(--am-foil)]" aria-hidden="true" />
	{#each both as { locale } (locale)}
		<div lang={locale} class="mt-6">
			<h1 class="display text-3xl font-bold">{m.offline_title({}, { locale })}</h1>
			<p class="mt-3 text-muted-foreground">{m.offline_body({}, { locale })}</p>
		</div>
	{/each}
	<!-- A full reload, not client routing: the point is to ask the network again. -->
	<button
		type="button"
		onclick={() => location.reload()}
		class="mt-8 h-12 rounded-full bg-[var(--am-ribbon)] px-8 text-sm font-semibold text-white"
	>
		{m.offline_retry({}, { locale: 'en' })} · {m.offline_retry({}, { locale: 'am' })}
	</button>
</section>
