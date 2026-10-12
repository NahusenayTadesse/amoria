<!--
	The shop's filter panel: search, type, categories (several at once), price, availability and
	deals, each choice with how many items it would show. Kit fields throughout, bound to the
	page's filter store; the same panel is the sidebar on wide screens and the "Filters" sheet on
	phones (`idPrefix` keeps their ids apart).
-->
<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import type { Writable } from 'svelte/store';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localized } from '$lib/localized';
	import {
		PRICE_RANGES,
		SHOP_TYPES,
		type FilterFields,
		type ShopType,
		type facetCounts
	} from '$lib/shopFilter';

	type Props = {
		/** The page's filter, as the fields hold it. */
		form: Writable<FilterFields>;
		/** Never filled: filters have nothing to refuse. `InputComp` reads it. */
		errors: Writable<Record<string, unknown>>;
		facets: ReturnType<typeof facetCounts>;
		categories: { id: number; slug: string; name: string; nameAm: string | null }[];
		bounds: { min: number; max: number };
		/** Where "Create your own package" leads, when there is a box to build. */
		buildHref: string | null;
		idPrefix: string;
	};
	let { form, errors, facets, categories, bounds, buildHref, idPrefix }: Props = $props();

	const typeLabels: Record<ShopType, () => string> = {
		gift: m.shop_type_gift,
		bundle: m.shop_type_bundle,
		custom: m.shop_type_custom
	};
	const plain = (n: number) => n.toLocaleString('en-US');
	const rangeLabel = ([min, max]: [number | null, number | null]) =>
		min === null
			? m.shop_price_under({ max: plain(max!) })
			: max === null
				? m.shop_price_over({ min: plain(min) })
				: m.shop_price_between({ min: plain(min), max: plain(max) });

	// The kit's `InputComp` takes its store loosely typed (indexed by `name`).
	const fields = $derived(form as unknown as Writable<Record<string, unknown>>);

	const typeItems = $derived(
		SHOP_TYPES.map((type) => ({
			value: type,
			name: typeLabels[type](),
			meta: String(facets.types[type])
		}))
	);
	const categoryItems = $derived(
		categories.map((c) => ({
			value: c.id,
			name: localized(c, 'name'),
			meta: String(facets.categories.get(c.id) ?? 0)
		}))
	);
	const priceItems = $derived(
		PRICE_RANGES.map((range, index) => ({
			value: String(index),
			name: rangeLabel(range),
			meta: String(facets.prices[index])
		}))
	);

	const section = 'border-b border-border py-4 first:pt-0 last:border-b-0';
</script>

<div class="flex flex-col">
	<div class={section}>
		<InputComp
			form={fields}
			{errors}
			name="q"
			id="{idPrefix}-q"
			type="search"
			label={m.shop_search()}
			placeholder={m.shop_search_placeholder()}
		/>
	</div>

	{#if buildHref}
		<div class={section}>
			<a
				href={resolve(buildHref as AppPath)}
				class="flex items-center gap-3 rounded-[var(--radius)] bg-[var(--am-ink)] px-4 py-3 text-sm font-semibold text-white active:opacity-90"
			>
				<Sparkles class="h-4 w-4 shrink-0" aria-hidden="true" />
				{m.build_banner_title()}
			</a>
		</div>
	{/if}

	<div class={section}>
		<InputComp
			form={fields}
			{errors}
			name="types"
			id="{idPrefix}-types"
			type="checkbox"
			label={m.shop_type()}
			items={typeItems}
			selectAll={false}
		/>
	</div>

	{#if categories.length > 1}
		<div class={section}>
			<InputComp
				form={fields}
				{errors}
				name="cats"
				id="{idPrefix}-cats"
				type="checkbox"
				label={m.shop_categories()}
				items={categoryItems}
				selectAll={false}
			/>
		</div>
	{/if}

	<div class={section}>
		<InputComp
			form={fields}
			{errors}
			name="price"
			id="{idPrefix}-price"
			type="radio"
			label={m.shop_price()}
			items={priceItems}
		/>
		<div class="grid grid-cols-2 gap-2">
			<InputComp
				form={fields}
				{errors}
				name="min"
				id="{idPrefix}-min"
				type="number"
				min={0}
				label={m.shop_price_min()}
				placeholder={plain(bounds.min)}
			/>
			<InputComp
				form={fields}
				{errors}
				name="max"
				id="{idPrefix}-max"
				type="number"
				min={0}
				label={m.shop_price_max()}
				placeholder={plain(bounds.max)}
			/>
		</div>
		{#if bounds.max > 0}
			<p class="mt-1 px-1 text-xs text-muted-foreground">
				{formatETB(bounds.min)} – {formatETB(bounds.max)}
			</p>
		{/if}
	</div>

	<div class={section}>
		<InputComp
			form={fields}
			{errors}
			name="inStock"
			id="{idPrefix}-stock"
			type="checkboxSingle"
			label={m.shop_availability()}
			placeholder="{m.shop_in_stock()} ({facets.inStock})"
		/>
	</div>

	<div class={section}>
		<InputComp
			form={fields}
			{errors}
			name="onSale"
			id="{idPrefix}-sale"
			type="checkboxSingle"
			label={m.shop_deals()}
			placeholder="{m.shop_on_sale()} ({facets.onSale})"
		/>
	</div>
</div>
