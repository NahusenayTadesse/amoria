<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import { bundleAdd, bundleEdit } from '$lib/schemas/catalog';
	import { extraColumns } from './columns';

	let { data } = $props();

	const fields: LookupField[] = [
		{ name: 'name', label: 'Name', type: 'text' },
		{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false, inTable: false },
		{
			name: 'type',
			label: 'Kind',
			type: 'select',
			choices: [
				{ value: 'fixed', name: 'Ready-made: staff choose the gifts' },
				{ value: 'custom', name: 'Built by customers: they fill the container' }
			],
			inTable: false
		},
		{
			name: 'containerId',
			label: 'Comes in (box, basket or wrap)',
			type: 'reference',
			options: 'containerList',
			display: 'container',
			required: false
		},
		{
			name: 'discountPercent',
			label: 'Discount (%)',
			type: 'number',
			required: false
		},
		{
			name: 'categoryId',
			label: 'Also show under category',
			type: 'reference',
			options: 'categoryList',
			display: 'category',
			required: false,
			inTable: false
		},
		{
			name: 'slug',
			label: 'Link name (left empty: made from the name)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'description',
			label: 'Description',
			type: 'textarea',
			rows: 3,
			required: false,
			inTable: false
		},
		{
			name: 'descriptionAm',
			label: 'Description (Amharic)',
			type: 'textarea',
			rows: 3,
			required: false,
			inTable: false
		},
		{
			name: 'sortOrder',
			label: 'Order on the shop (lower first)',
			type: 'number',
			required: false,
			inTable: false
		},
		{
			name: 'isFeatured',
			label: 'Staff pick (shown first)',
			type: 'checkbox',
			required: false,
			inTable: false,
			trueLabel: 'Yes',
			falseLabel: 'No'
		},
		{
			name: 'published',
			label: 'Show on the shop',
			type: 'checkbox',
			required: false,
			inTable: false,
			trueLabel: 'Yes',
			falseLabel: 'No'
		},
		{ name: 'status', label: 'Active', type: 'boolean' }
	];
</script>

<svelte:head>
	<title>Bundles | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold">Bundles</h1>
	<p class="text-muted-foreground">
		Several gifts sold as one item, at a discount off what they cost separately. A ready-made bundle
		holds the gifts staff choose; one built by customers lets them fill a container within its
		rules. Add the bundle here, then open it for its gifts and photos. A container is a gift with
		rules: set what fits in it on that gift’s page. Prices follow the gifts’ prices, and selling one
		takes each gift (and the container) from stock.
	</p>
	<LookupPage
		{data}
		schemas={{ add: bundleAdd, edit: bundleEdit }}
		config={{ entity: 'Bundle', plural: 'Bundles', fields, extraColumns }}
	/>
</div>
