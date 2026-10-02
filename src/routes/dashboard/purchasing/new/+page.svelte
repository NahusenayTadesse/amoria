<script lang="ts">
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { orderHeader } from '$lib/schemas/inventory';
	import OrderHeaderFields from '../OrderHeaderFields.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, orderHeader, {
		resetForm: false
	});
</script>

<div class="flex max-w-3xl flex-col gap-4">
	<PageHeader
		title="New purchase order"
		tabTitle="New purchase order | Amoria"
		description="Who you are ordering from and where it goes. You add the products on the next screen."
	/>
	<form method="POST" use:enhance>
		<FormCard title="Details">
			<OrderHeaderFields {form} {errors} suppliers={data.suppliers} locations={data.locations} />
		</FormCard>
		<div class="mt-4">
			<Button type="submit">
				{#if $delayed}<LoadingBtn name="Saving" />{:else}Start the order{/if}
			</Button>
		</div>
	</form>
</div>
