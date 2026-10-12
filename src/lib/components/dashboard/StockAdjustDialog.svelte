<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { MANUAL_REASONS, STOCK_REASON_META } from '$lib/stock';
	import { stockAdjustSchema } from '$lib/schemas/dashboard';

	/**
	 * Records a stock change for one product: a movement with a reason (delivery in, damage out…)
	 * or a stock count that sets the shelf to what was counted. Built from the kit's `FormDialog`;
	 * the reasons and their direction come from `$lib/stock`, so a new reason appears here by itself.
	 */
	type Props = {
		data: SuperValidated<Record<string, unknown>>;
		action: string;
		/** Which product, for the stock page; omitted on the product's own page. */
		productId?: number;
		productName: string;
		/** The total that can be sold, across every location. */
		onHand: number;
		/** Where the change can happen; the first is the default (the shop floor). */
		locations?: { value: number; name: string }[];
		open?: boolean;
		hideTrigger?: boolean;
	};

	let {
		data,
		action,
		productId,
		productName,
		onHand,
		locations = [],
		open = $bindable(false),
		hideTrigger = false
	}: Props = $props();

	const reasonItems = MANUAL_REASONS.map((reason) => {
		const meta = STOCK_REASON_META[reason];
		const sign =
			meta.direction === 'in' ? '(adds)' : meta.direction === 'out' ? '(removes)' : '(+ or −)';
		return { value: reason, name: `${meta.label} ${sign}` };
	});
</script>

<FormDialog
	title="Adjust stock: {productName}"
	description="On record now: {onHand}. Every change is kept in the stock ledger with your name."
	{action}
	{data}
	schema={stockAdjustSchema}
	triggerLabel="Adjust stock"
	submitLabel="Save"
	seed={{
		productId,
		locationId: locations[0]?.value,
		mode: 'move',
		reason: 'delivery',
		qty: 0,
		counted: onHand,
		note: ''
	}}
	bind:open
	{hideTrigger}
	resetOnSuccess
>
	{#snippet fields({ form, errors, values })}
		{#if productId !== undefined}<InputComp {form} {errors} name="productId" type="hidden" />{/if}
		{#if locations.length > 1}
			<InputComp
				{form}
				{errors}
				name="locationId"
				id="adjust-location"
				type="select"
				label="Where"
				items={locations}
			/>
		{/if}
		<InputComp
			{form}
			{errors}
			name="mode"
			id="adjust-mode"
			type="radio"
			label="What kind of change"
			items={[
				{ value: 'move', name: 'Add or remove' },
				{ value: 'count', name: 'Stock count' }
			]}
		/>

		{#if values.mode === 'count'}
			<InputComp
				{form}
				{errors}
				name="counted"
				type="number"
				min="0"
				label="Counted at that location"
				description="The difference from what is on record there is recorded as a correction."
			/>
		{:else}
			<InputComp
				{form}
				{errors}
				name="reason"
				id="adjust-reason"
				type="select"
				label="Reason"
				items={reasonItems}
			/>
			{#if STOCK_REASON_META[values.reason as keyof typeof STOCK_REASON_META]?.hint}
				<p class="-mt-2 text-xs text-muted-foreground">
					{STOCK_REASON_META[values.reason as keyof typeof STOCK_REASON_META].hint}
				</p>
			{/if}
			<InputComp
				{form}
				{errors}
				name="qty"
				type="number"
				label="How many"
				description={STOCK_REASON_META[values.reason as keyof typeof STOCK_REASON_META]
					?.direction === 'either'
					? 'Negative to remove, positive to add.'
					: undefined}
			/>
		{/if}
		<InputComp {form} {errors} name="note" label="Note (supplier, what happened), optional" />
	{/snippet}
</FormDialog>
