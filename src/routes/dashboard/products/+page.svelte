<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import { productAdd, productEdit } from '$lib/schemas/catalog';
	import { extraColumns } from './columns';

	let { data } = $props();

	const fields: LookupField[] = [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'kind',
			label: 'Kind',
			type: 'select',
			choices: [
				{ value: 'gift', name: 'Gift (sold)' },
				{ value: 'rental', name: 'Rental equipment' }
			],
			inTable: false
		},
		{
			name: 'categoryId',
			label: 'Category',
			type: 'reference',
			options: 'categoryList',
			display: 'category'
		},
		{ name: 'price', label: 'Price (gifts)', type: 'money', required: false },
		{
			name: 'dailyRate',
			label: 'Daily rate (rentals)',
			type: 'money',
			required: false,
			inTable: false
		},
		{ name: 'deposit', label: 'Rental deposit', type: 'money', required: false, inTable: false },
		{
			name: 'minRentalDays',
			label: 'Minimum rental days',
			type: 'number',
			required: false,
			inTable: false
		},
		{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false, inTable: false },
		{
			name: 'slug',
			label: 'Link name (left empty: made from the name)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'lowStockThreshold',
			label: 'Warn when stock falls to (empty: shop default)',
			type: 'number',
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
	<title>Products | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold">Products</h1>
	<p class="text-muted-foreground">
		Gifts and rental equipment. Stock is not changed here: open a product to record deliveries,
		damage or a stock count. New products start with 0 in stock.
	</p>
	<LookupPage
		{data}
		schemas={{ add: productAdd, edit: productEdit }}
		config={{ entity: 'Product', plural: 'Products', fields, extraColumns }}
	/>
</div>
