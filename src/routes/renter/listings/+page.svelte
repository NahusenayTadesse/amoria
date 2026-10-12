<script lang="ts">
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import type { AppPath } from '$lib/paths';
	import { columns } from './columns';

	let { data } = $props();

	const approved = $derived(data.renter.status === 'approved');
	const fixes = $derived(data.rows.filter((row) => row.status === 'rejected'));
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="My rentals"
		tabTitle="My rentals | Amoria renters"
		description={data.renter.autoPublish
			? 'Everything you rent out on Amoria. You are trusted: new rentals and changes go live at once.'
			: 'Everything you rent out on Amoria. New rentals and changes are checked by Amoria before they go live, usually within a day.'}
	>
		{#snippet actions()}
			{#if approved}
				<Button href={resolve('/renter/listings/new' as AppPath)}
					><Plus class="size-4" /> List a rental</Button
				>
			{/if}
		{/snippet}
	</PageHeader>

	{#if !approved}
		<Notice tone="info" title="Not yet.">
			You can list rentals once Amoria has approved your business.
		</Notice>
	{/if}

	{#each fixes as row (row.id)}
		<Notice tone="warning" title="{row.name}: changes needed.">
			{row.reviewNote ?? 'Amoria asked for changes.'} Open it, fix it and save: it goes back for review.
		</Notice>
	{/each}

	{#key data.rows}
		<DataTable {columns} data={data.rows} search={true} fileName="My rentals" />
	{/key}
</div>
