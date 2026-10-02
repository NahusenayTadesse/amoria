<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import DateInput from '@nahu/admin-kit/formComponents/DateInput.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { addLocalDays, localToday } from '@nahu/admin-kit/time';

	/**
	 * The period a report covers: two dates and quick ranges, all as query parameters so a refresh
	 * or a shared link keeps the view. Other parameters on the page (a product, a threshold) stay.
	 */
	let { from, to }: { from: string; to: string } = $props();

	const RANGES = [
		{ label: '7 days', days: 7 },
		{ label: '30 days', days: 30 },
		{ label: '90 days', days: 90 },
		{ label: 'A year', days: 365 }
	];

	function href(days: number) {
		const url = new URL(page.url);
		const today = localToday();
		url.searchParams.set('from', addLocalDays(today, -(days - 1)));
		url.searchParams.set('to', today);
		return `${url.pathname}${url.search}`;
	}

	/** The rest of the query, so applying dates does not drop a chosen product or threshold. */
	const others = $derived(
		[...page.url.searchParams.entries()].filter(([key]) => key !== 'from' && key !== 'to')
	);
</script>

<form method="GET" class="flex flex-wrap items-end gap-3">
	{#each others as [key, value] (key)}
		<input type="hidden" name={key} {value} />
	{/each}
	<label class="flex flex-col gap-1 text-sm">
		<span class="text-muted-foreground">From</span>
		<DateInput name="from" value={from} id="period-from" />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="text-muted-foreground">To</span>
		<DateInput name="to" value={to} id="period-to" />
	</label>
	<Button type="submit" variant="outline">Show</Button>
	<nav class="flex flex-wrap gap-1 text-sm" aria-label="Quick ranges">
		{#each RANGES as range (range.days)}
			<a
				class="rounded-md border px-2.5 py-1.5 text-muted-foreground hover:bg-accent"
				href={resolve(href(range.days) as AppPath)}>{range.label}</a
			>
		{/each}
	</nav>
</form>
