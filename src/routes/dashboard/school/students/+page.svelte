<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { page } from '$app/state';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { ethiopianDate } from '@nahu/admin-kit/tableCells';
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

<div class="flex flex-col gap-4">
	<PageHeader
		title="Students"
		tabTitle="Students | Amoria"
		description="Registrations for the décor school. &quot;Needs action&quot; is a transfer receipt to check, or a student who paid after the class filled up."
	>
		{#snippet actions()}
			<nav class="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="Which registrations">
				{#each [{ key: 'action', label: 'Needs action' }, { key: 'all', label: 'All registrations' }] as const as tab (tab.key)}
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
		{/snippet}
	</PageHeader>

	{#if data.intake}
		<p class="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
			Showing one class: {data.intake.title}, from
			{ethiopianDate(new Date(`${data.intake.startDate}T12:00:00+03:00`))}.
			<a href={resolve('/dashboard/school/students')} class="text-primary hover:underline"
				>Show every class</a
			>
		</p>
	{/if}

	{#key data.rows}
		<DataTable
			{columns}
			data={data.rows}
			server={data.server}
			facetKeys={['status']}
			facetLabels={{ status: 'Status' }}
			dateFilter="Registered"
			fileName="Students"
		/>
	{/key}
</div>
