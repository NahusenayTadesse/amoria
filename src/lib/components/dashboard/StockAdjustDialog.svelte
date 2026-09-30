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
		onHand: number;
		open?: boolean;
		hideTrigger?: boolean;
	};

	let {
		data,
		action,
		productId,
		productName,
		onHand,
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
	seed={{ productId, mode: 'move', reason: 'delivery', qty: 0, counted: onHand, note: '' }}
	bind:open
	{hideTrigger}
	resetOnSuccess
>
	{#snippet fields({ form, errors, values })}
		{#if productId !== undefined}<input type="hidden" name="productId" value={productId} />{/if}
		<fieldset class="flex gap-2 text-sm">
			<legend class="sr-only">What kind of change</legend>
			{#each [{ value: 'move', label: 'Add or remove' }, { value: 'count', label: 'Stock count' }] as option (option.value)}
				<label
					class={[
						'flex-1 cursor-pointer rounded-md border p-2 text-center',
						values.mode === option.value && 'border-primary bg-primary/5 font-semibold'
					]}
				>
					<input
						type="radio"
						name="mode"
						value={option.value}
						checked={values.mode === option.value}
						onchange={() => form.update((v) => ({ ...v, mode: option.value }))}
						class="sr-only"
					/>
					{option.label}
				</label>
			{/each}
		</fieldset>

		{#if values.mode === 'count'}
			<InputComp
				{form}
				{errors}
				name="counted"
				type="number"
				min="0"
				label="Counted on the shelf"
				description="The difference from {onHand} is recorded as a correction."
			/>
		{:else}
			<!--
				Native, not the kit's SelectComp: inside this dialog the kit's option list is portalled out of
				the modal and hidden from screen readers (the same issue as the checkout's area picker).
			-->
			<div class="grid gap-2">
				<label for="adjust-reason" class="text-sm font-medium">Reason</label>
				<select
					id="adjust-reason"
					name="reason"
					value={values.reason}
					onchange={(e) => form.update((v) => ({ ...v, reason: e.currentTarget.value }))}
					class="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
				>
					{#each reasonItems as item (item.value)}
						<option value={item.value}>{item.name}</option>
					{/each}
				</select>
			</div>
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
