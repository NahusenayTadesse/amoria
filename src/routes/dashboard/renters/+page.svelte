<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import type { AppPath } from '$lib/paths';
	import { columns } from './columns';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Renters"
		tabTitle="Renters | Amoria"
		description="Businesses that rent their things out on the marketplace. Check each one's TIN and trade licence before approving; only approved renters can list, and you decide who may post without review."
	>
		{#snippet actions()}
			<Button
				href={resolve('/dashboard/renters/listings?status=pending_review' as AppPath)}
				variant="outline"
			>
				Listings to review
			</Button>
			<Button href={resolve('/dashboard/renters/orders' as AppPath)} variant="outline">
				Marketplace orders
			</Button>
		{/snippet}
	</PageHeader>
	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status']}
			facetLabels={{ status: 'Status' }}
			dateFilter="Signed up"
			fileName="Renters"
		/>
	{/key}
</div>
