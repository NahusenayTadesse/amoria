<script lang="ts">
	import { resolve } from '$app/paths';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { DOCUMENT_HINTS, DOCUMENT_LABELS } from '$lib/stock';
	import { columns } from './columns';

	let { data } = $props();

	const kinds = ['receipt', 'issue', 'transfer', 'adjustment'] as const;
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Stock documents"
		tabTitle="Stock documents | Amoria"
		description="The paper behind every stock change that is not a sale: deliveries, issues, transfers, adjustments and returns. A draft changes nothing until it is posted."
	>
		{#snippet actions()}
			{#each kinds as kind (kind)}
				<Button
					variant={kind === 'receipt' ? 'default' : 'outline'}
					size="sm"
					href={resolve('/dashboard/stock/documents/new') + `?type=${kind}`}
					title={DOCUMENT_HINTS[kind]}
				>
					New {DOCUMENT_LABELS[kind].toLowerCase()}
				</Button>
			{/each}
		{/snippet}
	</PageHeader>

	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['typeLabel', 'statusLabel']}
			facetLabels={{ typeLabel: 'Kind', statusLabel: 'Status' }}
			facetParams={{ typeLabel: 'type', statusLabel: 'status' }}
			dateFilter="Date"
			fileName="Stock documents"
		/>
	{/key}
</div>
