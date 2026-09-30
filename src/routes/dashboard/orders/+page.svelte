<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { page } from '$app/state';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	let { data } = $props();

	/** The two queues, as links: a query param, so a refresh or a shared link keeps the view. */
	function queueHref(queue: 'action' | 'all') {
		const url = new URL(page.url);
		url.searchParams.delete('page');
		if (queue === 'all') url.searchParams.set('queue', 'all');
		else url.searchParams.delete('queue');
		return `${url.pathname}${url.search}`;
	}
</script>

<svelte:head>
	<title>Orders | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold">Orders</h1>
			<p class="text-muted-foreground">
				Gift shop orders. "Needs action" is what is paid and not yet handed over, short of an item,
				or waiting for a receipt check.
			</p>
		</div>
		<nav class="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="Which orders">
			{#each [{ key: 'action', label: 'Needs action' }, { key: 'all', label: 'All orders' }] as const as tab (tab.key)}
				<a
					href={resolve(queueHref(tab.key) as AppPath)}
					aria-current={data.queue === tab.key ? 'page' : undefined}
					class={[
						'rounded-md px-3 py-1.5',
						data.queue === tab.key
							? 'bg-background font-semibold shadow-sm'
							: 'text-muted-foreground'
					]}
				>
					{tab.label}
				</a>
			{/each}
		</nav>
	</div>

	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status', 'fulfilment']}
			facetLabels={{ status: 'Status', fulfilment: 'Pickup / delivery' }}
			dateFilter="Placed"
			fileName="Orders"
		/>
	{/key}
</div>
