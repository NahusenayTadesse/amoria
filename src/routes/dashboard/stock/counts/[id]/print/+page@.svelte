<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { ethDay } from '$lib/stock';

	let { data } = $props();
</script>

<svelte:head><title>Count #{data.count.id} | Amoria</title></svelte:head>

<PrintSheet branch={data.business}>
	<h1 class="text-xl font-semibold">Stock count #{data.count.id}</h1>
	<p class="my-2 text-sm text-muted-foreground">
		{data.location}{data.category ? `, ${data.category} only` : ''} · {ethDay(data.count.countDate)}
	</p>
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b-2 text-left">
				<th class="py-1">Product</th>
				<th class="py-1">Lot</th>
				{#if data.showExpected}<th class="py-1 text-right">Expected</th>{/if}
				<th class="w-28 py-1 text-right">Counted</th>
			</tr>
		</thead>
		<tbody>
			{#each data.lines as line (line.id)}
				<tr class="border-b">
					<td class="py-2">{line.product}{line.sku ? ` · ${line.sku}` : ''}</td>
					<td class="py-2"
						>{line.lotNumber ?? ''}{line.expiryDate ? ` (exp. ${line.expiryDate})` : ''}</td
					>
					{#if data.showExpected}
						<td class="py-2 text-right tabular-nums">{line.expected} {line.unit}</td>
					{/if}
					<td class="py-2"><div class="ml-auto h-6 w-24 border-b border-black"></div></td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="mt-8 grid grid-cols-2 gap-8 text-sm">
		<div class="border-t pt-1">Counted by</div>
		<div class="border-t pt-1">Checked by</div>
	</div>
</PrintSheet>
