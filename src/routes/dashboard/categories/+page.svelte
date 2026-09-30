<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import { categoryAdd, categoryEdit } from '$lib/schemas/catalog';

	let { data } = $props();
</script>

<svelte:head><title>Categories | Amoria</title></svelte:head>

<h1 class="mb-2 text-2xl font-semibold">Categories</h1>
<LookupPage
	{data}
	schemas={{ add: categoryAdd, edit: categoryEdit }}
	config={{
		entity: 'Category',
		plural: 'Categories',
		fields: [
			{ name: 'name', label: 'Name', type: 'text' },
			{
				name: 'kind',
				label: 'For',
				type: 'select',
				choices: [
					{ value: 'gift', name: 'Gifts' },
					{ value: 'rental', name: 'Rental equipment' }
				]
			},
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{
				name: 'slug',
				label: 'Link name (left empty: made from the name)',
				type: 'text',
				required: false,
				inTable: false
			},
			{ name: 'sortOrder', label: 'Order (lower first)', type: 'number', required: false },
			{ name: 'status', label: 'Shown on the shop', type: 'boolean' }
		]
	}}
/>
