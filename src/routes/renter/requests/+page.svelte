<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { renterOrderColumns } from '$lib/components/dashboard/renterOrderColumns';

	let { data } = $props();
	const columns = renterOrderColumns();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Quote requests"
		tabTitle="Quote requests | Amoria renters"
		description="Customers asking for your price. Open one, check the dates, and send a quote; they accept and pay you by transfer. Answer quickly: the first good quote usually wins."
	/>
	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status']}
			facetLabels={{ status: 'Status' }}
			dateFilter="Received"
			fileName="Quote requests"
		/>
	{/key}
</div>
