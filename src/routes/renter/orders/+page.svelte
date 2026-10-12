<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { renterOrderColumns } from '$lib/components/dashboard/renterOrderColumns';

	let { data } = $props();
	const columns = renterOrderColumns();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Orders and payments"
		tabTitle="Orders | Amoria renters"
		description="Every booking and request. Open one to check the customer's payment receipt, hand it over, or finish it. Filter by &quot;Receipt to check&quot; to see what is waiting for you."
	/>
	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status', 'origin']}
			facetLabels={{ status: 'Status', origin: 'How it started' }}
			dateFilter="Received"
			fileName="Orders"
		/>
	{/key}
</div>
