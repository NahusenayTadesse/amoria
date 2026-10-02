<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { columns } from './columns';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Till shifts"
		tabTitle="Till shifts | Amoria"
		description="Each shift is opened with a float and closed by counting the drawer. A difference is recorded, not hidden."
	/>
	<DataTable {columns} data={data.rows} fileName="Till shifts" />
</div>
