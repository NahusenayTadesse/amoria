<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	let { data } = $props();
</script>

<svelte:head>
	<title>Quote requests | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div>
		<h1 class="text-2xl font-semibold">Quote requests</h1>
		<p class="text-muted-foreground">
			What customers send from "Plan your décor". Open one to see the details and reach the customer
			the way they asked.
		</p>
	</div>

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
