<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Printer from '@lucide/svelte/icons/printer';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethDay } from '$lib/stock';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';

	let { data } = $props();

	let picked = $state<Record<number, boolean>>({});
	const ids = $derived(
		Object.entries(picked)
			.filter(([, on]) => on)
			.map(([id]) => id)
	);

	function toggleAll(on: boolean) {
		for (const p of data.products) picked[p.id] = on;
	}
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Barcodes and labels"
		tabTitle="Labels | Amoria"
		description="Print shelf labels with the name, price and barcode. Products without a barcode of their own can be given an in-store one."
	/>

	<ActionResult />

	<PageSection
		title="Barcodes"
		hint="{data.missing} product{data.missing === 1 ? ' has' : 's have'} no barcode."
	>
		<form method="POST" action="?/assign" use:enhance>
			<Button type="submit" variant="outline" disabled={!data.missing}>
				Give barcodes to products without one
			</Button>
		</form>
	</PageSection>

	<PageSection title="Labels for a delivery" hint="Everything on a posted goods receipt.">
		<form
			method="GET"
			action={resolve('/dashboard/labels/print')}
			target="_blank"
			class="flex flex-wrap items-end gap-3"
		>
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted-foreground">Delivery</span>
				<select name="document" class="h-9 min-w-64 rounded-md border bg-background px-3" required>
					<option value="">Choose a delivery…</option>
					{#each data.deliveries as d (d.id)}
						<option value={d.id}>{d.number} · {ethDay(d.docDate)}</option>
					{/each}
				</select>
			</label>
			<Button type="submit"><Printer /> Print labels</Button>
		</form>
	</PageSection>

	<PageSection title="Labels for chosen products">
		<form method="GET" class="mb-3 flex items-end gap-2">
			<label class="flex flex-1 flex-col gap-1 text-sm">
				<span class="text-muted-foreground">Find a product</span>
				<Input name="q" value={data.q} placeholder="Name, code or barcode" class="h-9 max-w-sm" />
			</label>
			<Button type="submit" variant="outline">Search</Button>
		</form>

		<form
			method="GET"
			action={resolve('/dashboard/labels/print')}
			target="_blank"
			class="flex flex-col gap-3"
		>
			<div class="max-h-[26rem] overflow-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-muted text-left text-muted-foreground">
						<tr>
							<th class="w-10 p-2">
								<input
									type="checkbox"
									class="size-4 accent-primary"
									aria-label="Choose all shown"
									onchange={(e) => toggleAll(e.currentTarget.checked)}
								/>
							</th>
							<th class="p-2 font-medium">Product</th>
							<th class="p-2 font-medium">Code</th>
							<th class="p-2 font-medium">Barcode</th>
							<th class="p-2 text-right font-medium">Price</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.products as p (p.id)}
							<tr>
								<td class="p-2">
									<input
										type="checkbox"
										name="ids"
										value={p.id}
										bind:checked={picked[p.id]}
										class="size-4 accent-primary"
										aria-label="Print a label for {p.name}"
									/>
								</td>
								<td class="p-2">{p.name}</td>
								<td class="p-2">{p.sku ?? '—'}</td>
								<td class="p-2">{p.barcode ?? '—'}</td>
								<td class="p-2 text-right tabular-nums"
									>{p.price == null ? '—' : formatETB(p.price)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="flex flex-wrap items-end gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-muted-foreground">Copies of each</span>
					<Input name="copies" type="number" min="1" max="50" value="1" class="h-9 w-24" />
				</label>
				<Button type="submit" disabled={!ids.length}>
					<Printer /> Print {ids.length} label{ids.length === 1 ? '' : 's'}
				</Button>
			</div>
		</form>
	</PageSection>
</div>
