<script lang="ts">
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { documentHeader } from '$lib/schemas/inventory';
	import { DOCUMENT_HINTS } from '$lib/stock';
	import DocumentHeaderFields from '$lib/components/dashboard/DocumentHeaderFields.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, documentHeader, {
		resetForm: false
	});
</script>

<div class="flex max-w-3xl flex-col gap-4">
	<PageHeader
		title={data.title}
		tabTitle="{data.title} | Amoria"
		description="{DOCUMENT_HINTS[data.type]}. You add the lines on the next screen."
	/>
	<form method="POST" use:enhance>
		<FormCard title="Details">
			<DocumentHeaderFields
				{form}
				{errors}
				type={data.type}
				locations={data.locations}
				suppliers={data.suppliers}
			/>
		</FormCard>
		<div class="mt-4">
			<Button type="submit">
				{#if $delayed}<LoadingBtn name="Saving" />{:else}Start the draft{/if}
			</Button>
		</div>
	</form>
</div>
