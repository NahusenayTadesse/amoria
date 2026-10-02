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
		title="Stock counts"
		tabTitle="Stock counts | Amoria"
		description="Count what is really on the shelf against what the system expects. Posting turns every difference into one adjustment."
	>
		{#snippet actions()}
			<Button href={resolve('/dashboard/stock/counts/new')}>Start a count</Button>
		{/snippet}
	</PageHeader>

	<DataTable {columns} data={data.rows} fileName="Stock counts" />
</div>
