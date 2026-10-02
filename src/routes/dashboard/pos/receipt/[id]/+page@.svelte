<script lang="ts">
	import { formatETB } from '@nahu/admin-kit/global';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { POS_METHOD_LABELS, ethDay } from '$lib/stock';

	let { data } = $props();
	const doc = $derived(data.doc);
	const refund = $derived(doc.type === 'sales_return');
</script>

<svelte:head><title>{doc.number} | Amoria</title></svelte:head>

<div class="mx-auto my-4 w-[80mm] max-w-full font-mono text-[12px] leading-snug text-black">
	<header class="text-center">
		<div class="text-base font-bold">Amoria</div>
		{#if data.address}<div>{data.address}</div>{/if}
		{#if data.phone}<div>{data.phone}</div>{/if}
	</header>
	<hr class="my-2 border-dashed border-black" />
	<div class="flex justify-between">
		<span>{refund ? 'REFUND' : 'RECEIPT'} {doc.number}</span>
		<span>{ethDay(doc.docDate)}</span>
	</div>
	{#if doc.reference}<div>Refund of {doc.reference}</div>{/if}
	{#if doc.cashier}<div>Served by {doc.cashier}</div>{/if}
	<hr class="my-2 border-dashed border-black" />

	<table class="w-full">
		<tbody>
			{#each data.lines as line (line.id)}
				<tr>
					<td colspan="2" class="pt-1">{line.name}</td>
				</tr>
				<tr>
					<td class="pl-2">
						{line.quantity} × {formatETB(line.unitPrice ?? 0)}
						{#if line.listPrice != null && line.unitPrice != null && line.unitPrice < line.listPrice}
							<span class="opacity-70">(was {formatETB(line.listPrice)})</span>
						{/if}
					</td>
					<td class="text-right tabular-nums">{formatETB(line.lineTotal)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<hr class="my-2 border-dashed border-black" />

	<dl class="grid grid-cols-[1fr_auto] gap-x-2 tabular-nums">
		{#if data.vatRegistered && doc.vatTotal != null}
			<dt>Before VAT</dt>
			<dd class="text-right">{formatETB(doc.subtotal ?? 0)}</dd>
			<dt>VAT {data.vatRate}%</dt>
			<dd class="text-right">{formatETB(doc.vatTotal)}</dd>
		{/if}
		<dt class="text-sm font-bold">{refund ? 'REFUNDED' : 'TOTAL'}</dt>
		<dd class="text-right text-sm font-bold">{formatETB(doc.total ?? 0)}</dd>
		{#each data.payments as p, i (i)}
			<dt>{p.amount < 0 ? 'Paid back by' : 'Paid by'} {POS_METHOD_LABELS[p.method]}</dt>
			<dd class="text-right">{formatETB(Math.abs(p.amount))}</dd>
		{/each}
	</dl>

	{#if data.footer}
		<hr class="my-2 border-dashed border-black" />
		<p class="text-center">{data.footer}</p>
	{/if}

	<div class="mt-4 text-center print:hidden">
		<Button onclick={() => window.print()}>Print</Button>
	</div>
</div>

<style>
	@media print {
		:global(body) {
			margin: 0;
		}
	}
</style>
