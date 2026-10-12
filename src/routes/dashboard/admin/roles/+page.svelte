<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { roleAdd } from '$lib/schemas/staff';
	import { columns } from './columns';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Roles"
		tabTitle="Roles | Amoria"
		description="A role is a job, such as Shop clerk or Store keeper, and the permissions that go with it. Each staff member has one. The Admin role always has every permission."
	>
		{#snippet actions()}
			<FormDialog
				title="Add a role"
				description="Name it after the job. You tick its permissions on the next page."
				action="?/add"
				data={data.addForm}
				schema={roleAdd}
				triggerLabel="Add a role"
				submitLabel="Add and choose permissions"
			>
				{#snippet fields({ form, errors })}
					<InputComp {form} {errors} name="name" label="Name" required />
					<InputComp {form} {errors} name="description" type="textarea" label="What it is for" />
				{/snippet}
			</FormDialog>
		{/snippet}
	</PageHeader>

	<DataTable {columns} data={data.rows} fileName="Roles" />
</div>
