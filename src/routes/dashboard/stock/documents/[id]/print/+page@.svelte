<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethDay } from '$lib/stock';

	let { data } = $props();
	const doc = $derived(data.doc);
	const priced = $derived(data.lines.some((l) => l.unitPrice != null));
	const costed = $derived(data.lines.some((l) => l.unitCost != null));
</script>

<svelte:head><title>{doc.number ?? 'Draft'} | Amoria</title></svelte:head>

<PrintSheet branch={data.business}>
	<h1 class="text-xl font-semibold">{data.typeLabel} {doc.number ?? '(draft)'}</h1>
	<dl class="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
		<dt class="text-muted-foreground">Date</dt>
		<dd>{ethDay(doc.docDate)} ({doc.docDate})</dd>
		{#if data.from}<dt class="text-muted-foreground">From</dt>
			<dd>{data.from}</dd>{/if}
		{#if data.to}<dt class="text-muted-foreground">To</dt>
			<dd>{data.to}</dd>{/if}
		{#if data.supplier}<dt class="text-muted-foreground">Supplier</dt>
			<dd>{data.supplier}</dd>{/if}
		{#if doc.party}<dt class="text-muted-foreground">For</dt>
			<dd>{doc.party}</dd>{/if}
		{#if doc.reference}<dt class="text-muted-foreground">Reference</dt>
			<dd>{doc.reference}</dd>{/if}
		{#if doc.note}<dt class="text-muted-foreground">Note</dt>
			<dd>{doc.note}</dd>{/if}
	</dl>

	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b-2 text-left">
				<th class="py-1">Product</th>
				<th class="py-1">Lot</th>
				<th class="py-1 text-right">Qty</th>
				{#if costed}<th class="py-1 text-right">Cost each</th>{/if}
				{#if priced}<th class="py-1 text-right">Price each</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each data.lines as line (line.id)}
				<tr class="border-b">
					<td class="py-1">
						{line.product}{#if line.sku}<span class="text-muted-foreground">
								· {line.sku}</span
							>{/if}
					</td>
					<td class="py-1">
						{line.lot ?? line.lotNumber ?? ''}{line.expiryDate ? ` (exp. ${line.expiryDate})` : ''}
					</td>
					<td class="py-1 text-right tabular-nums">{line.quantity} {line.unit}</td>
					{#if costed}
						<td class="py-1 text-right tabular-nums">
							{line.unitCost == null ? '' : formatETB(line.unitCost)}
						</td>
					{/if}
					{#if priced}
						<td class="py-1 text-right tabular-nums">
							{line.unitPrice == null ? '' : formatETB(line.unitPrice)}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>

	{#if doc.total != null}
		<dl class="mt-3 ml-auto grid max-w-xs grid-cols-2 gap-x-6 text-sm tabular-nums">
			<dt>Before VAT</dt>
			<dd class="text-right">{formatETB(doc.subtotal ?? 0)}</dd>
			<dt>VAT</dt>
			<dd class="text-right">{formatETB(doc.vatTotal ?? 0)}</dd>
			<dt class="font-semibold">Total</dt>
			<dd class="text-right font-semibold">{formatETB(doc.total)}</dd>
		</dl>
	{/if}

	<div class="mt-10 grid grid-cols-2 gap-8 text-sm">
		<div class="border-t pt-1">Prepared by {data.postedBy ?? ''}</div>
		<div class="border-t pt-1">Received by</div>
	</div>
</PrintSheet>
