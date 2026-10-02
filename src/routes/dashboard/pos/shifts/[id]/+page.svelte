<script lang="ts">
	import { resolve } from '$app/paths';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { formatETB } from '@nahu/admin-kit/global';
	import { POS_METHOD_LABELS, badge } from '$lib/stock';

	let { data } = $props();
	const s = $derived(data.summary.shift);

	const details = $derived([
		{ name: 'Cashier', value: data.summary.cashier ?? '—' },
		{ name: 'Selling from', value: data.summary.location },
		{ name: 'Opened', value: ethiopianDateTime(s.openedAt) },
		...(s.closedAt ? [{ name: 'Closed', value: ethiopianDateTime(s.closedAt) }] : []),
		{ name: 'Opened with', value: formatETB(s.floatAmount) },
		{ name: 'Cash expected', value: formatETB(s.expectedCash ?? data.summary.expectedCash) },
		...(s.countedCash != null ? [{ name: 'Cash counted', value: formatETB(s.countedCash) }] : []),
		...(data.difference != null
			? [
					{
						name: 'Difference',
						value: data.difference === 0 ? 'None' : formatETB(data.difference)
					}
				]
			: []),
		...(s.note ? [{ name: 'Note', value: s.note, long: 120 }] : [])
	]);
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Till shift" title="Shift #{s.id}" tabTitle="Shift #{s.id} | Amoria">
		{#snippet badges()}
			<Statuses {...badge(s.status)} />
		{/snippet}
	</PageHeader>

	<PageSection title="Details"><SingleTable singleTable={details} /></PageSection>

	<PageSection title="Taken, by method">
		{#if data.summary.methods.length}
			<ul class="flex flex-col gap-1 text-sm tabular-nums">
				{#each data.summary.methods as m (m.method)}
					<li class="flex max-w-sm justify-between">
						<span>{POS_METHOD_LABELS[m.method]}</span>
						<span>
							{formatETB(m.taken)}
							{#if m.paidOut}<span class="text-muted-foreground">
									− {formatETB(m.paidOut)} refunded</span
								>{/if}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">Nothing sold yet.</p>
		{/if}
	</PageSection>

	<PageSection title="Sales">
		<ul class="divide-y text-sm">
			{#each data.sales as sale (sale.id)}
				<li class="flex max-w-xl items-center justify-between gap-3 py-2">
					<a
						class="underline"
						href={resolve('/dashboard/pos/receipt/[id]', { id: String(sale.id) })}
						target="_blank">{sale.number}</a
					>
					<span class="text-muted-foreground"
						>{sale.type === 'sales_return' ? 'Refund' : 'Sale'}</span
					>
					<span class="tabular-nums">{formatETB(sale.total ?? 0)}</span>
				</li>
			{:else}
				<li class="py-2 text-muted-foreground">No sales in this shift.</li>
			{/each}
		</ul>
	</PageSection>
</div>
