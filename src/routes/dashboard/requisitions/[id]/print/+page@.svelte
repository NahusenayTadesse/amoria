<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { ethDay } from '$lib/stock';

	let { data } = $props();
	const req = $derived(data.req);
</script>

<svelte:head><title>{req.number ?? 'Draft'} | Amoria</title></svelte:head>

<PrintSheet branch={data.business}>
	<h1 class="text-xl font-semibold">Requisition {req.number ?? '(draft)'}</h1>
	<dl class="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
		<dt class="text-muted-foreground">Asked by</dt>
		<dd>{req.requester}</dd>
		<dt class="text-muted-foreground">For</dt>
		<dd>{data.purposeLabel}</dd>
		<dt class="text-muted-foreground">From store</dt>
		<dd>{data.store}</dd>
		<dt class="text-muted-foreground">Date</dt>
		<dd>{ethDay(req.requestDate)}</dd>
		{#if req.neededBy}<dt class="text-muted-foreground">Needed by</dt>
			<dd>{ethDay(req.neededBy)}</dd>{/if}
		{#if req.note}<dt class="text-muted-foreground">Note</dt>
			<dd>{req.note}</dd>{/if}
	</dl>
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b-2 text-left">
				<th class="py-1">Product</th>
				<th class="py-1 text-right">Asked for</th>
				<th class="py-1 text-right">Approved</th>
			</tr>
		</thead>
		<tbody>
			{#each data.lines as line (line.id)}
				<tr class="border-b">
					<td class="py-1">{line.product}{line.sku ? ` · ${line.sku}` : ''}</td>
					<td class="py-1 text-right tabular-nums">{line.quantity} {line.unit}</td>
					<td class="py-1 text-right tabular-nums">
						{line.approvedQuantity == null ? '' : `${line.approvedQuantity} ${line.unit}`}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="mt-10 grid grid-cols-3 gap-6 text-sm">
		<div class="border-t pt-1">Asked by</div>
		<div class="border-t pt-1">Approved by</div>
		<div class="border-t pt-1">Received by</div>
	</div>
</PrintSheet>
