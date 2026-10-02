<script lang="ts">
	import { resolve } from '$app/paths';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { formatETB } from '@nahu/admin-kit/global';
	import { closeShiftSchema, openShiftSchema } from '$lib/schemas/inventory';
	import { POS_METHOD_LABELS } from '$lib/stock';
	import Till from '$lib/components/dashboard/Till.svelte';

	let { data } = $props();

	const stats = $derived(
		data.summary
			? (
					[
						{ key: 'sales', label: 'Sales this shift', value: data.summary.sales, format: 'count' },
						{ key: 'taken', label: 'Taken', value: data.summary.takenTotal, format: 'money' },
						{
							key: 'cash',
							label: 'Cash expected in the drawer',
							value: data.summary.expectedCash,
							format: 'money'
						},
						{
							key: 'float',
							label: 'Opened with',
							value: data.summary.shift.floatAmount,
							format: 'money'
						}
					] as const
				).map((s) => ({ ...s, group: 'till' }))
			: []
	);

	// Each form exists only in the state of the page that uses it.
	// svelte-ignore state_referenced_locally
	const open = data.openForm ? createForm(data.openForm, openShiftSchema) : null;
	// svelte-ignore state_referenced_locally
	const close = data.closeForm ? createForm(data.closeForm, closeShiftSchema) : null;
	const openDelayed = open?.delayed;
	const closeDelayed = close?.delayed;
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Till"
		tabTitle="Till | Amoria"
		description={data.shift
			? `Selling from ${data.shift.location}.`
			: 'Open the till with the cash in the drawer to start selling.'}
	>
		{#snippet actions()}
			<Button variant="outline" href={resolve('/dashboard/pos/return')}>Customer return</Button>
			<Button variant="outline" href={resolve('/dashboard/pos/shifts')}>Shifts</Button>
		{/snippet}
	</PageHeader>

	{#if !data.shift && open}
		<form method="POST" action="?/open" use:open.enhance class="max-w-md">
			<FormCard
				title="Open the till"
				description="Count the cash in the drawer and enter it as the float."
			>
				<InputComp
					form={open.form}
					errors={open.errors}
					name="floatAmount"
					type="number"
					min="0"
					step="0.01"
					label="Cash in the drawer (ETB)"
				/>
			</FormCard>
			<div class="mt-4">
				<Button type="submit">
					{#if $openDelayed}<LoadingBtn name="Opening" />{:else}Open the till{/if}
				</Button>
			</div>
		</form>
	{:else if data.shift && data.summary}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each stats as stat (stat.key)}
				<StatCard {stat} amharicMoney={false} />
			{/each}
		</div>

		<Till canDiscount={data.canDiscount} vat={data.vat} methods={data.methods} />

		{#if close}
			<PageSection
				title="Close the till"
				hint="Count the drawer. It should hold {formatETB(
					data.summary.expectedCash
				)}. Any difference is recorded."
			>
				<form method="POST" action="?/close" use:close.enhance class="flex max-w-md flex-col gap-3">
					<InputComp
						form={close.form}
						errors={close.errors}
						name="countedCash"
						type="number"
						min="0"
						step="0.01"
						label="Cash counted (ETB)"
					/>
					<InputComp
						form={close.form}
						errors={close.errors}
						name="note"
						label="Note"
						required={false}
					/>
					<div>
						<Button type="submit" variant="outline">
							{#if $closeDelayed}<LoadingBtn name="Closing" />{:else}Close the till{/if}
						</Button>
					</div>
				</form>
				{#if data.summary.methods.length}
					<ul class="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
						{#each data.summary.methods as m (m.method)}
							<li>
								{POS_METHOD_LABELS[m.method]}:
								<span class="tabular-nums">{formatETB(m.taken - m.paidOut)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</PageSection>
		{/if}
	{/if}
</div>
