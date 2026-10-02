<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';

	let { data } = $props();

	// What is ticked and how many, kept as the page's own state: the rows are the user's to edit.
	// svelte-ignore state_referenced_locally
	let ticked = $state<Record<number, boolean>>(
		Object.fromEntries(data.suggestions.map((s) => [s.id, Boolean(s.supplierId)]))
	);
	// svelte-ignore state_referenced_locally
	let amounts = $state<Record<number, number>>(
		Object.fromEntries(data.suggestions.map((s) => [s.id, s.suggested]))
	);
	const chosen = $derived(data.suggestions.filter((s) => ticked[s.id] && amounts[s.id] > 0));
	const withoutSupplier = $derived(data.suggestions.filter((s) => !s.supplierId));
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="What to reorder"
		tabTitle="Reorder | Amoria"
		description="Products at or under their reorder level, or that will run out before a delivery could arrive at the recent rate of use. Ticked rows become one draft order per supplier."
	/>

	<form method="GET" class="flex flex-wrap items-end gap-3 text-sm">
		<label class="flex flex-col gap-1">
			<span class="text-muted-foreground">Plan for</span>
			<select
				name="location"
				class="h-9 rounded-md border bg-background px-3"
				onchange={(e) => e.currentTarget.form?.submit()}
			>
				<option value="">Everywhere (each product's own level)</option>
				{#each data.locations as l (l.value)}
					<option value={l.value} selected={data.locationId === l.value}>{l.name}</option>
				{/each}
			</select>
		</label>
		<noscript><Button type="submit" variant="outline" size="sm">Show</Button></noscript>
	</form>

	<ActionResult />

	{#if !data.suggestions.length}
		<Empty
			title="Nothing to reorder: every product is above its level and will last past a delivery."
		/>
	{:else}
		{#if withoutSupplier.length}
			<Notice tone="warning">
				{withoutSupplier.length} product{withoutSupplier.length === 1 ? ' has' : 's have'} no main supplier,
				so they cannot be ordered from here. Set one on the product, or
				<a class="underline" href={resolve('/dashboard/products')}>open the products</a>.
			</Notice>
		{/if}
		<form method="POST" action="?/order" use:enhance class="flex flex-col gap-3">
			<div class="overflow-x-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead class="bg-muted/50 text-left text-muted-foreground">
						<tr>
							<th class="w-10 p-2"><span class="sr-only">Order</span></th>
							<th class="p-2 font-medium">Product</th>
							<th class="p-2 font-medium">Supplier</th>
							<th class="p-2 text-right font-medium">On hand</th>
							<th class="p-2 text-right font-medium">On order</th>
							<th class="p-2 text-right font-medium">Used a day</th>
							<th class="p-2 text-right font-medium">Days left</th>
							<th class="p-2 text-right font-medium">Lead time</th>
							<th class="w-28 p-2 text-right font-medium">Order</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.suggestions as s (s.id)}
							<tr class={!s.supplierId ? 'opacity-60' : ''}>
								<td class="p-2">
									<input
										type="checkbox"
										name="pick"
										value={s.id}
										bind:checked={ticked[s.id]}
										disabled={!s.supplierId}
										aria-label="Order {s.name}"
										class="size-4 accent-primary"
									/>
								</td>
								<td class="p-2">
									<a
										class="hover:underline"
										href={resolve('/dashboard/products/[id]', { id: String(s.id) })}>{s.name}</a
									>
									<div class="text-xs text-muted-foreground">
										{s.belowMin
											? `At or under ${s.reorderLevel}`
											: 'Will run out before a delivery'}
									</div>
								</td>
								<td class="p-2">{s.supplier ?? '—'}</td>
								<td class="p-2 text-right tabular-nums">{s.onHand}</td>
								<td class="p-2 text-right tabular-nums">{s.onOrder}</td>
								<td class="p-2 text-right tabular-nums">{s.usagePerDay || '—'}</td>
								<td class="p-2 text-right tabular-nums">{s.daysLeft ?? '—'}</td>
								<td class="p-2 text-right tabular-nums">
									{s.leadTimeDays} d{s.leadTimeAssumed ? ' (assumed)' : ''}
								</td>
								<td class="p-2 text-right">
									<Input
										type="number"
										min="0"
										name="qty_{s.id}"
										bind:value={amounts[s.id]}
										class="h-8 w-24 text-right tabular-nums"
										aria-label="How many {s.name} to order"
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div>
				<Button type="submit" disabled={!chosen.length}>
					Make draft orders ({chosen.length})
				</Button>
			</div>
		</form>
	{/if}
</div>
