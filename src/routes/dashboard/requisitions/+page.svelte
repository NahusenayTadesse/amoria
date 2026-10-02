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
		title="Requisitions"
		tabTitle="Requisitions | Amoria"
		description="A team asks the store for materials (the décor crew for an event, the school for a class). Someone else approves it, cutting quantities if need be, and the store issues it."
	>
		{#snippet actions()}
			<Button href={resolve('/dashboard/requisitions/new')}>New requisition</Button>
		{/snippet}
	</PageHeader>

	<DataTable {columns} data={data.rows} fileName="Requisitions" />
</div>
