<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { PRICE_UNIT_LABELS } from '$lib/rentalMarket';
	import { PRICE_UNITS } from '$lib/constants';

	/** A listing's fields, for the new-rental page and each rental's own page. */
	type Props = {
		form: ComponentProps<typeof InputComp>['form'];
		errors: ComponentProps<typeof InputComp>['errors'];
		categories: { id: number; name: string }[];
	};
	let { form, errors, categories }: Props = $props();

	const quoteOnly = $derived($form.pricing === 'quote');
</script>

<FormCard title="What it is" description="A clear name and a few honest lines sell it.">
	<div class="grid gap-4 sm:grid-cols-2">
		<InputComp
			{form}
			{errors}
			name="categoryId"
			type="select"
			label="Category"
			items={categories.map((c) => ({ value: String(c.id), name: c.name }))}
		/>
		<InputComp
			{form}
			{errors}
			name="quantity"
			type="number"
			min="1"
			label="How many you have"
			description="Bookings over the same days share these."
		/>
		<InputComp
			{form}
			{errors}
			name="name"
			label="Name"
			description="e.g. “Garden tent for 200 guests”"
		/>
		<InputComp {form} {errors} name="nameAm" label="Name, in Amharic" />
		<InputComp {form} {errors} name="summary" label="One line for the card" />
		<InputComp {form} {errors} name="summaryAm" label="One line, in Amharic" />
		<div class="sm:col-span-2">
			<InputComp {form} {errors} name="description" type="textarea" rows={5} label="Description" />
		</div>
		<div class="sm:col-span-2">
			<InputComp
				{form}
				{errors}
				name="descriptionAm"
				type="textarea"
				rows={5}
				label="Description, in Amharic"
			/>
		</div>
		<InputComp
			{form}
			{errors}
			name="features"
			type="textarea"
			rows={4}
			label="What comes with it (one per line)"
			description="e.g. 2 × 1000 W speakers, generator, a technician"
		/>
		<InputComp
			{form}
			{errors}
			name="featuresAm"
			type="textarea"
			rows={4}
			label="What comes with it, in Amharic"
		/>
		<InputComp
			{form}
			{errors}
			name="capacity"
			type="number"
			label="Guests it holds (venues and tents)"
		/>
		<InputComp
			{form}
			{errors}
			name="youtubeUrl"
			label="YouTube video (optional)"
			description="A watch, youtu.be or Shorts link."
		/>
		<InputComp
			{form}
			{errors}
			name="deliveryAvailable"
			type="checkboxSingle"
			label="We can deliver it"
			placeholder="We can deliver it"
			hideLabel
		/>
		<InputComp
			{form}
			{errors}
			name="setupIncluded"
			type="checkboxSingle"
			label="Setting it up is included"
			placeholder="Setting it up is included"
			hideLabel
		/>
	</div>
</FormCard>

<FormCard
	title="Price"
	description="A fixed price lets customers book and pay at once. Quote only: they ask, you name a price."
>
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<InputComp
				{form}
				{errors}
				name="pricing"
				type="radio"
				label="How it is priced"
				items={[
					{ value: 'fixed', name: 'Fixed price: customers book now and pay' },
					{ value: 'quote', name: 'Quote only: customers ask, I name the price' }
				]}
			/>
		</div>
		<InputComp
			{form}
			{errors}
			name="price"
			type="number"
			min="0"
			step="0.01"
			label={quoteOnly ? 'Starting from (ETB, optional)' : 'Price (ETB)'}
		/>
		<InputComp
			{form}
			{errors}
			name="priceUnit"
			type="select"
			label="The price is"
			items={PRICE_UNITS.map((unit) => ({ value: unit, name: PRICE_UNIT_LABELS[unit] }))}
		/>
		<InputComp
			{form}
			{errors}
			name="deposit"
			type="number"
			min="0"
			step="0.01"
			label="Refundable deposit per item (ETB)"
			description="Added to the total; 0 for none. You return it yourself."
		/>
	</div>
</FormCard>
