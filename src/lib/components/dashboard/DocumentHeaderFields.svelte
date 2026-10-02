<script lang="ts">
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { ADJUSTMENT_REASON_LABELS } from '$lib/stock';
	import type { Option } from '$lib/server/options';

	/**
	 * The header of a draft stock document: which fields show depends on its kind. Used by the
	 * "new" page and the draft's own page, so the two can never disagree.
	 */
	type Props = {
		// The superforms stores, typed as the kit's InputComp takes them.
		form: Parameters<typeof InputComp>[1]['form'];
		errors: Parameters<typeof InputComp>[1]['errors'];
		type: 'receipt' | 'issue' | 'transfer' | 'adjustment';
		locations: Option[];
		suppliers: Option[];
	};
	let { form, errors, type, locations, suppliers }: Props = $props();

	const reasons = Object.entries(ADJUSTMENT_REASON_LABELS).map(([value, name]) => ({
		value,
		name
	}));
</script>

<input type="hidden" name="type" value={type} />
<div class="grid gap-4 sm:grid-cols-2">
	<InputComp {form} {errors} name="docDate" type="date" label="Date" />

	{#if type === 'receipt'}
		<InputComp
			{form}
			{errors}
			name="toLocationId"
			type="select"
			label="Received at"
			items={locations}
		/>
		<InputComp
			{form}
			{errors}
			name="supplierId"
			type="select"
			label="Delivered by"
			items={suppliers}
		/>
		<InputComp
			{form}
			{errors}
			name="reference"
			label="Supplier's invoice or delivery note"
			required={false}
		/>
	{:else if type === 'issue'}
		<InputComp
			{form}
			{errors}
			name="fromLocationId"
			type="select"
			label="Taken from"
			items={locations}
		/>
		<InputComp
			{form}
			{errors}
			name="party"
			label="Used for"
			placeholder="Wedding crew, Class 4…"
			required={false}
		/>
		<InputComp {form} {errors} name="reference" label="Reference" required={false} />
	{:else if type === 'transfer'}
		<InputComp {form} {errors} name="fromLocationId" type="select" label="From" items={locations} />
		<InputComp {form} {errors} name="toLocationId" type="select" label="To" items={locations} />
	{:else}
		<InputComp
			{form}
			{errors}
			name="fromLocationId"
			type="select"
			label="Location"
			items={locations}
		/>
		<InputComp {form} {errors} name="reason" type="select" label="Why" items={reasons} />
	{/if}
</div>
<InputComp {form} {errors} name="note" type="textarea" rows={2} label="Note" required={false} />
