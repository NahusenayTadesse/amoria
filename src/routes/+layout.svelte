<script lang="ts">
	import type { AppPath } from '$lib/paths';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" type="image/png" href="/brand/icons/favicon-32.png" /></svelte:head>
{@render children()}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as AppPath)}>{locale}</a>
	{/each}
</div>
