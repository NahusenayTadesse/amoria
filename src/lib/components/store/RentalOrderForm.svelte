<!--
	A marketplace order (§5.12): "Book now" on a fixed-price rental, or "Ask for a quote". The
	contact, the dates, how many, and a note; for "Book now" the price it comes to, worked out with
	the same rule the server charges (`$lib/rentalMarket`), which reads the price again itself.
-->
<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { birr } from '$lib/localized';
	import { askSchema, bookSchema } from '$lib/schemas/renters';
	import { fixedPrice, rentalDays, type PriceUnit } from '$lib/rentalMarket';
	import { unitText } from '$lib/marketText';
	import ContactFields from './ContactFields.svelte';

	type Props = {
		data: SuperValidated<Record<string, unknown>>;
		kind: 'book' | 'ask';
		/** Set for "Book now": what one unit costs, so the total can be shown before sending. */
		priced?: { price: number; unit: PriceUnit; deposit: number; quantity: number } | null;
		/** How many of it the renter has: the most one order may take. */
		maxQty?: number;
		/** Hourly rentals ask how many hours. */
		hourly?: boolean;
	};
	let { data, kind, priced = null, maxQty = 1000, hourly = false }: Props = $props();

	// Set up once from the page's form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(
		data,
		kind === 'book' ? bookSchema : askSchema,
		{ resetForm: false }
	);

	const total = $derived.by(() => {
		if (!priced || !$form.startDate) return null;
		const days = rentalDays(String($form.startDate), String($form.endDate || $form.startDate));
		if (days < 1) return null;
		return fixedPrice({
			price: priced.price,
			unit: priced.unit,
			deposit: priced.deposit,
			qty: Math.max(1, Number($form.qty) || 1),
			days,
			hours: Number($form.hours) || 1
		});
	});
</script>

<form
	method="POST"
	action="?/{kind}"
	use:enhance
	class="flex flex-col gap-4"
	aria-label={kind === 'book' ? m.market_book_now() : m.market_ask_quote()}
>
	<ContactFields {form} {errors} idPrefix={kind} />
	<div class="grid gap-4 sm:grid-cols-2">
		<InputComp
			{form}
			{errors}
			name="startDate"
			id="{kind}-startDate"
			type="date"
			label={m.rent_start()}
			oldDays={false}
			year
			required
		/>
		<InputComp
			{form}
			{errors}
			name="endDate"
			id="{kind}-endDate"
			type="date"
			label={m.rent_end()}
			oldDays={false}
			year
			description={m.rent_end_hint()}
		/>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<InputComp
			{form}
			{errors}
			name="qty"
			id="{kind}-qty"
			type="number"
			min={1}
			max={maxQty}
			label={m.rent_qty()}
		/>
		{#if hourly}
			<InputComp
				{form}
				{errors}
				name="hours"
				id="{kind}-hours"
				type="number"
				min={1}
				max={24}
				label={m.rent_hours()}
			/>
		{/if}
	</div>
	<InputComp
		{form}
		{errors}
		name="venue"
		id="{kind}-venue"
		label={m.quote_venue()}
		placeholder={m.quote_venue_hint()}
	/>
	<InputComp
		{form}
		{errors}
		name="message"
		id="{kind}-message"
		type="textarea"
		rows={3}
		label={kind === 'ask' ? m.rent_ask_message() : m.quote_message()}
	/>

	{#if priced}
		<div class="rounded-[var(--radius)] bg-secondary p-4 text-sm" aria-live="polite">
			{#if total}
				<dl class="flex flex-col gap-1">
					<div class="flex justify-between gap-3">
						<dt class="text-muted-foreground">
							{birr(priced.price)}
							{unitText(priced.unit)} × {total.units} × {Math.max(1, Number($form.qty) || 1)}
						</dt>
						<dd class="tabular-nums">{birr(total.subtotal)}</dd>
					</div>
					{#if total.deposit > 0}
						<div class="flex justify-between gap-3">
							<dt class="text-muted-foreground">{m.rent_deposit()}</dt>
							<dd class="tabular-nums">{birr(total.deposit)}</dd>
						</div>
					{/if}
					<div class="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
						<dt>{m.build_total()}</dt>
						<dd class="text-base tabular-nums">{birr(total.total)}</dd>
					</div>
				</dl>
			{:else}
				<p class="text-muted-foreground">{m.rent_pick_dates()}</p>
			{/if}
		</div>
		<p class="text-sm text-muted-foreground">{m.rent_book_next()}</p>
	{:else}
		<p class="text-sm text-muted-foreground">{m.rent_ask_next()}</p>
	{/if}

	<button
		type="submit"
		disabled={$delayed}
		class="btn-shine h-13 w-full rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] disabled:opacity-60"
	>
		{#if $delayed}<LoadingBtn name={m.rent_sending()} />{:else}{kind === 'book'
				? m.market_book_now()
				: m.market_ask_quote()}{/if}
	</button>
</form>
