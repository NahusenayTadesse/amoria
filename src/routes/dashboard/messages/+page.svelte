<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	let { data } = $props();
</script>

<svelte:head>
	<title>Messages | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div>
		<h1 class="text-2xl font-semibold">Messages</h1>
		<p class="text-muted-foreground">
			Notes customers send from the contact page. Open one to read it and reply the way they asked,
			then mark it replied.
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
			fileName="Messages"
		/>
	{/key}
</div>
