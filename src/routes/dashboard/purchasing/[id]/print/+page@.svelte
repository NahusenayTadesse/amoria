<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethDay } from '$lib/stock';

	let { data } = $props();
	const order = $derived(data.order);
	const total = $derived(data.lines.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0));
	const priced = $derived(data.lines.some((l) => l.unitCost != null));
</script>

<svelte:head><title>{order.number ?? 'Draft order'} | Amoria</title></svelte:head>

<PrintSheet branch={data.business}>
	<h1 class="text-xl font-semibold">Purchase order {order.number ?? '(draft)'}</h1>
	<dl class="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
		<dt class="text-muted-foreground">To</dt>
		<dd>{data.supplier}{data.phone ? `, ${data.phone}` : ''}</dd>
		<dt class="text-muted-foreground">Date</dt>
		<dd>{ethDay(order.orderDate)} ({order.orderDate})</dd>
		{#if order.expectedDate}
			<dt class="text-muted-foreground">Please deliver by</dt>
			<dd>{ethDay(order.expectedDate)}</dd>
		{/if}
		<dt class="text-muted-foreground">Deliver to</dt>
		<dd>{data.location}</dd>
		{#if order.reference}<dt class="text-muted-foreground">Reference</dt>
			<dd>{order.reference}</dd>{/if}
		{#if order.note}<dt class="text-muted-foreground">Note</dt>
			<dd>{order.note}</dd>{/if}
	</dl>

	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b-2 text-left">
				<th class="py-1">Product</th>
				<th class="py-1 text-right">Qty</th>
				{#if priced}<th class="py-1 text-right">Price each</th><th class="py-1 text-right">Total</th
					>{/if}
			</tr>
		</thead>
		<tbody>
			{#each data.lines as line (line.id)}
				<tr class="border-b">
					<td class="py-1">
						{line.product}{#if line.sku}<span class="text-muted-foreground">
								· {line.sku}</span
							>{/if}
						{#if line.note}<div class="text-xs text-muted-foreground">{line.note}</div>{/if}
					</td>
					<td class="py-1 text-right tabular-nums">{line.quantity} {line.unit}</td>
					{#if priced}
						<td class="py-1 text-right tabular-nums">
							{line.unitCost == null ? '' : formatETB(line.unitCost)}
						</td>
						<td class="py-1 text-right tabular-nums">
							{line.unitCost == null ? '' : formatETB(line.unitCost * line.quantity)}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
		{#if priced}
			<tfoot>
				<tr>
					<td colspan="3" class="py-2 text-right font-semibold">Total</td>
					<td class="py-2 text-right font-semibold tabular-nums">{formatETB(total)}</td>
				</tr>
			</tfoot>
		{/if}
	</table>
</PrintSheet>
