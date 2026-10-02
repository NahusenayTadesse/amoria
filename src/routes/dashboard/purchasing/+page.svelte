<script lang="ts">
	import { resolve } from '$app/paths';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { columns } from './columns';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Purchase orders"
		tabTitle="Purchase orders | Amoria"
		description="What has been ordered from suppliers and what has arrived. Receive a delivery from the order and it is filled in for you."
	>
		{#snippet actions()}
			<Button variant="outline" href={resolve('/dashboard/purchasing/reorder')}
				>What to reorder</Button
			>
			<Button href={resolve('/dashboard/purchasing/new')}>New order</Button>
		{/snippet}
	</PageHeader>

	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['statusLabel']}
			facetLabels={{ statusLabel: 'Status' }}
			facetParams={{ statusLabel: 'status' }}
			dateFilter="Ordered"
			fileName="Purchase orders"
		/>
	{/key}
</div>
