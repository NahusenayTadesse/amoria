<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import Printer from '@lucide/svelte/icons/printer';
	import X from '@lucide/svelte/icons/x';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { formatETB } from '@nahu/admin-kit/global';
	import { countFound } from '$lib/schemas/inventory';
	import { ethDay } from '$lib/stock';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';

	let { data } = $props();

	const count = $derived(data.count);
	const title = $derived(`Count #${count.id}`);
	const uncounted = $derived(data.lines.filter((l) => l.counted === null).length);
	const differences = $derived(data.lines.filter((l) => l.variance !== null && l.variance !== 0));
	const worth = $derived(differences.reduce((sum, l) => sum + Math.abs(l.varianceValue ?? 0), 0));

	// svelte-ignore state_referenced_locally
	const found = data.found ? createForm(data.found.form, countFound, { resetForm: true }) : null;
	const foundDelayed = found?.delayed;
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Stock count" {title} tabTitle="{title} | Amoria">
		{#snippet badges()}
			<Statuses {...data.badge} />
		{/snippet}
		{#snippet actions()}
			<Button
				variant="outline"
				href={resolve('/dashboard/stock/counts/[id]/print', { id: String(count.id) })}
				target="_blank"
			>
				<Printer /> Count sheet
			</Button>
			{#if data.isOpen && data.canPost}
				<ConfirmAction
					action="?/post"
					label="Post the count"
					title="Post this count?"
					description={uncounted
						? `${uncounted} lines are still not counted, so it will be refused.`
						: differences.length
							? `${differences.length} differences (about ${formatETB(worth)} at cost) become one stock adjustment.`
							: 'Nothing differs, so no adjustment is needed.'}
					icon={Check}
				/>
				<ConfirmAction
					action="?/cancel"
					label="Cancel"
					title="Cancel this count?"
					description="It stays on record and changes no stock."
					variant="outline"
					icon={X}
				/>
			{/if}
		{/snippet}
		{data.location}{data.category ? `, ${data.category} only` : ''}, {ethDay(count.countDate)}.
		{#if count.blind}Blind count.{/if}
		{#if data.adjustment}Adjustment {data.adjustment}.{/if}
	</PageHeader>

	<ActionResult />

	{#if data.moved > 0}
		<Notice tone="warning" title="Stock moved during the count">
			{data.moved} movement{data.moved === 1 ? '' : 's'} touched these products here after the count was
			opened. Posting applies what you found against what was expected then, so check the differences
			look right.
		</Notice>
	{/if}
	{#if data.hideExpected}
		<Notice tone="info">
			This is a blind count: what the system expects is hidden until it is posted by someone who
			may.
		</Notice>
	{/if}

	<PageSection
		title="Lines"
		hint={data.isOpen
			? 'Enter what you found, even if it is 0. A blank line is not counted yet.'
			: undefined}
	>
		<form method="POST" action="?/save" use:enhance>
			<div class="overflow-x-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead class="bg-muted/50 text-left text-muted-foreground">
						<tr>
							<th class="p-2 font-medium">Product</th>
							<th class="p-2 font-medium">Lot</th>
							{#if data.lines.some((l) => l.expected !== null)}
								<th class="p-2 text-right font-medium">Expected</th>
							{/if}
							<th class="w-32 p-2 text-right font-medium">Counted</th>
							{#if data.lines.some((l) => l.variance !== null)}
								<th class="p-2 text-right font-medium">Difference</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.lines as line (line.id)}
							<tr>
								<td class="p-2">
									{line.product}
									{#if line.added}<span class="text-xs text-muted-foreground">(found)</span>{/if}
								</td>
								<td class="p-2">
									{line.lotNumber ?? '—'}{line.expiryDate
										? ` · exp. ${ethDay(line.expiryDate)}`
										: ''}
								</td>
								{#if data.lines.some((l) => l.expected !== null)}
									<td class="p-2 text-right tabular-nums">{line.expected} {line.unit}</td>
								{/if}
								<td class="p-2 text-right">
									{#if data.isOpen}
										<Input
											type="number"
											min="0"
											name="counted_{line.id}"
											value={line.counted ?? ''}
											class="h-8 w-28 text-right tabular-nums"
											aria-label="Counted {line.product}"
										/>
									{:else}
										<span class="tabular-nums">{line.counted ?? '—'}</span>
									{/if}
								</td>
								{#if data.lines.some((l) => l.variance !== null)}
									<td
										class="p-2 text-right tabular-nums {line.variance
											? line.variance < 0
												? 'text-red-600'
												: 'text-green-700'
											: ''}"
									>
										{#if line.variance === null}—{:else if line.variance === 0}OK{:else}
											{line.variance > 0 ? '+' : ''}{line.variance}
											<span class="text-xs text-muted-foreground"
												>({formatETB(line.varianceValue ?? 0)})</span
											>
										{/if}
									</td>
								{/if}
							</tr>
						{:else}
							<tr>
								<td class="p-4 text-center text-muted-foreground" colspan="5">
									Nothing is on record here. Add what you find below.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.isOpen && data.lines.length}
				<div class="mt-3">
					<Button type="submit" variant="outline">Save counts</Button>
				</div>
			{/if}
		</form>
	</PageSection>

	{#if found && data.found}
		<PageSection
			title="Found on the shelf"
			hint="Something here that the system did not expect. Add it with how many you found."
		>
			<form method="POST" action="?/found" use:found.enhance class="max-w-2xl">
				<FormCard title="Add a product">
					<div class="grid gap-4 sm:grid-cols-3">
						<InputComp
							form={found.form}
							errors={found.errors}
							name="productId"
							type="combo"
							label="Product"
							items={data.found.products}
						/>
						<InputComp
							form={found.form}
							errors={found.errors}
							name="lotId"
							type="select"
							label="Lot (if it has one)"
							items={data.found.lots}
							required={false}
						/>
						<InputComp
							form={found.form}
							errors={found.errors}
							name="counted"
							type="number"
							min="0"
							label="How many"
						/>
					</div>
				</FormCard>
				<div class="mt-3">
					<Button type="submit" variant="outline" size="sm">
						{#if $foundDelayed}<LoadingBtn name="Adding" />{:else}Add to the count{/if}
					</Button>
				</div>
			</form>
		</PageSection>
	{/if}
</div>
