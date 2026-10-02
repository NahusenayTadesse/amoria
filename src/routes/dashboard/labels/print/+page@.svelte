<script lang="ts">
	import { formatETB } from '@nahu/admin-kit/global';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	let { data } = $props();
</script>

<svelte:head><title>Labels | Amoria</title></svelte:head>

<div class="p-4 print:p-0">
	<div class="mb-3 flex items-center gap-3 print:hidden">
		<Button onclick={() => window.print()}>Print {data.sheet.length} labels</Button>
		{#if data.truncated}
			<span class="text-sm text-amber-700">Only the first 600 fit on one go.</span>
		{/if}
	</div>

	<div class="grid grid-cols-3 gap-2 print:gap-1">
		{#each data.sheet as label, i (i)}
			<div
				class="flex break-inside-avoid flex-col items-center justify-between rounded border border-dashed p-2 text-center text-black print:border-gray-400"
			>
				<div class="text-sm leading-tight font-semibold">{label.name}</div>
				{#if label.nameAm}<div class="text-xs leading-tight">{label.nameAm}</div>{/if}
				{#if label.price != null}
					<div class="text-lg font-bold tabular-nums">{formatETB(label.price)}</div>
				{/if}
				<!-- Our own bwip-js output for a code we generated: markup we made, not user HTML. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="w-full [&>svg]:mx-auto [&>svg]:h-14 [&>svg]:w-auto">{@html label.svg}</div>
			</div>
		{/each}
	</div>
</div>
