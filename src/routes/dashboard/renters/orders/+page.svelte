<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { renterOrderColumns } from '$lib/components/dashboard/renterOrderColumns';

	let { data } = $props();
	const columns = renterOrderColumns({ withRenter: true });
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Marketplace orders"
		tabTitle="Marketplace orders | Amoria"
		description="Bookings and quote requests between customers and renters. Renters handle their own; this is for keeping an eye on things. The money goes straight to the renter."
	/>
	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status', 'origin']}
			facetLabels={{ status: 'Status', origin: 'How it started' }}
			dateFilter="Received"
			fileName="Marketplace orders"
		/>
	{/key}
</div>
