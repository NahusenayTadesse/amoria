<script lang="ts">
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { countOpen } from '$lib/schemas/inventory';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, countOpen, {
		resetForm: false
	});
</script>

<div class="flex max-w-3xl flex-col gap-4">
	<PageHeader
		title="Start a stock count"
		tabTitle="Start a count | Amoria"
		description="Opening a count records what the system expects now. Stock that moves after that is worth a look before you post."
	/>
	<form method="POST" use:enhance>
		<FormCard title="What to count">
			<div class="grid gap-4 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					name="locationId"
					type="select"
					label="Location"
					items={data.locations}
				/>
				<InputComp
					{form}
					{errors}
					name="categoryId"
					type="select"
					label="Only this category"
					items={data.categories}
					required={false}
				/>
				<InputComp {form} {errors} name="countDate" type="date" label="Count date" />
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					name="blind"
					bind:checked={$form.blind}
					class="size-4 accent-primary"
				/>
				Blind count: counters do not see the expected quantity
			</label>
			<InputComp
				{form}
				{errors}
				name="note"
				type="textarea"
				rows={2}
				label="Note"
				required={false}
			/>
		</FormCard>
		<div class="mt-4">
			<Button type="submit">
				{#if $delayed}<LoadingBtn name="Opening" />{:else}Open the count{/if}
			</Button>
		</div>
	</form>
</div>
