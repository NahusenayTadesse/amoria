<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { columns } from './columns';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Listings to review"
		tabTitle="Listings to review | Amoria"
		description="New rentals and changes from renters who are not trusted to post without review. Open one to see it as customers would, then approve it or say what to fix."
	/>
	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status']}
			facetLabels={{ status: 'Status' }}
			dateFilter="Changed"
			fileName="Renter listings"
		/>
	{/key}
</div>
