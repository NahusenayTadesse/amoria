<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { listingSchema } from '$lib/schemas/renters';
	import ListingFields from '../ListingFields.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, listingSchema, {
		resetForm: false
	});
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="List a rental"
		tabTitle="List a rental | Amoria renters"
		description="Anything that is used at an event: a venue, a tent, chairs, lights, a sound system, décor. Next you add its photos."
	/>
	<form method="POST" use:enhance class="grid max-w-3xl gap-4">
		<Errors allErrors={$allErrors} />
		<ListingFields {form} {errors} categories={data.categories} />
		<div>
			<Button type="submit" size="lg">
				{#if $delayed}<LoadingBtn name="Saving" />{:else}Save and add photos{/if}
			</Button>
		</div>
	</form>
</div>
