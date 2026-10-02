<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import Certificate from '$lib/components/Certificate.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.cert_meta_title({ number: data.certificate.certificateNo })}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-8">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<a
			href={resolve(localizeHref(`/reg/${data.token}`) as AppPath)}
			class="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" aria-hidden="true" />
			{m.cert_back()}
		</a>
		<button
			type="button"
			onclick={() => window.print()}
			class="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
		>
			<Printer class="h-4 w-4" aria-hidden="true" />
			{m.cert_print()}
		</button>
	</div>
	<div class="rounded-[1.5rem] border border-border shadow-sm">
		<Certificate {...data.certificate} />
	</div>
</div>
