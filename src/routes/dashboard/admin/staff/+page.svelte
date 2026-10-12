<script lang="ts">
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { columns } from './columns';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Staff"
		tabTitle="Staff | Amoria"
		description="Everyone who can sign in to the dashboard. What each person may do comes from their role, unless they have permissions of their own."
	>
		{#snippet actions()}
			<Button href={resolve('/dashboard/admin/staff/new')}><Plus /> Add a staff member</Button>
		{/snippet}
	</PageHeader>

	<DataTable {columns} data={data.rows} fileName="Staff" />
</div>
