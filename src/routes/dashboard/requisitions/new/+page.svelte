<script lang="ts">
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { requisitionHeader } from '$lib/schemas/inventory';
	import RequisitionHeaderFields from '../RequisitionHeaderFields.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, requisitionHeader, {
		resetForm: false
	});
</script>

<div class="flex max-w-3xl flex-col gap-4">
	<PageHeader
		title="New requisition"
		tabTitle="New requisition | Amoria"
		description="Who needs materials and for what. You add the products on the next screen, then send it for approval."
	/>
	<form method="POST" use:enhance>
		<FormCard title="Details">
			<RequisitionHeaderFields {form} {errors} locations={data.locations} quotes={data.quotes} />
		</FormCard>
		<div class="mt-4">
			<Button type="submit">
				{#if $delayed}<LoadingBtn name="Saving" />{:else}Start the requisition{/if}
			</Button>
		</div>
	</form>
</div>
