<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { formatETB } from '@nahu/admin-kit/global';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';
	import { roundBirr } from '$lib/money';

	let { data } = $props();

	// How many of each line is coming back and how it is paid back, as the page's own state.
	let quantities = $state<Record<number, number>>({});
	let method = $state('cash');
	const lines = $derived(data.sale?.lines ?? []);
	const refund = $derived(
		roundBirr(lines.reduce((sum, l) => sum + (quantities[l.id] ?? 0) * (l.unitPrice ?? 0), 0))
	);
	const payload = $derived(
		JSON.stringify({
			originalId: data.sale?.id ?? 0,
			method,
			lines: lines.map((l) => ({ lineId: l.id, quantity: quantities[l.id] ?? 0 }))
		})
	);
</script>

<div class="flex max-w-3xl flex-col gap-4">
	<PageHeader
		title="Customer return"
		tabTitle="Customer return | Amoria"
		description="Find the sale by the number on the customer's receipt. The goods go back on the shelf and the refund comes out of the drawer."
	/>

	{#if !data.hasShift}
		<Notice tone="warning">
			Open your till first: the refund is taken from its drawer.
			<a class="underline" href={resolve('/dashboard/pos')}>Go to the till</a>
		</Notice>
	{/if}

	<form method="GET" class="flex items-end gap-2">
		<label class="flex flex-1 flex-col gap-1 text-sm">
			<span class="text-muted-foreground">Receipt number</span>
			<Input name="receipt" value={data.receipt} placeholder="AM-ISS-2019-00042" class="h-10" />
		</label>
		<Button type="submit" variant="outline" class="h-10">Find the sale</Button>
	</form>

	<ActionResult />

	{#if data.notFound}
		<Notice tone="warning">
			No till sale has the number {data.receipt}. Check the receipt. Online orders are not returned
			here.
		</Notice>
	{/if}

	{#if data.sale}
		<PageSection title="{data.sale.number}, {formatETB(data.sale.total ?? 0)}">
			<form method="POST" action="?/return" use:enhance class="flex flex-col gap-3">
				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-sm">
						<thead class="bg-muted/50 text-left text-muted-foreground">
							<tr>
								<th class="p-2 font-medium">Product</th>
								<th class="p-2 text-right font-medium">Sold</th>
								<th class="p-2 text-right font-medium">Can come back</th>
								<th class="p-2 text-right font-medium">Price</th>
								<th class="w-28 p-2 text-right font-medium">Coming back</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each data.sale.lines as line (line.id)}
								<tr>
									<td class="p-2">{line.name}</td>
									<td class="p-2 text-right tabular-nums">{line.quantity}</td>
									<td class="p-2 text-right tabular-nums">{line.returnable}</td>
									<td class="p-2 text-right tabular-nums">{formatETB(line.unitPrice ?? 0)}</td>
									<td class="p-2 text-right">
										<Input
											type="number"
											min="0"
											max={line.returnable}
											disabled={line.returnable === 0}
											bind:value={quantities[line.id]}
											class="h-8 w-24 text-right tabular-nums"
											aria-label="How many {line.name} are coming back"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="flex flex-wrap items-end gap-4">
					<label class="flex flex-col gap-1 text-sm">
						<span class="text-muted-foreground">Refund paid by</span>
						<select bind:value={method} class="h-9 rounded-md border bg-background px-2">
							{#each data.methods as m (m.value)}
								<option value={m.value}>{m.name}</option>
							{/each}
						</select>
					</label>
					<p class="text-lg font-semibold tabular-nums">Refund {formatETB(refund)}</p>
				</div>
				<input type="hidden" name="payload" value={payload} />
				<div>
					<Button type="submit" disabled={!data.hasShift || refund <= 0}>Give the refund</Button>
				</div>
			</form>
		</PageSection>
	{/if}
</div>
