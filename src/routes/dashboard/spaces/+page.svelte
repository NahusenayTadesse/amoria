<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { spaceAdd, spaceEdit } from '$lib/schemas/spaces';
	import { extraColumns } from './columns';

	let { data } = $props();

	const fields: LookupField[] = [
		{ name: 'name', label: 'Name of the space', type: 'text' },
		{ name: 'capacity', label: 'Guests it holds', type: 'number', required: false },
		{ name: 'price', label: 'Price from (left empty: "ask")', type: 'money', required: false },
		{
			name: 'priceUnit',
			label: 'What the price buys (e.g. per day, per event)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'priceUnitAm',
			label: 'What the price buys, in Amharic',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'sizeText',
			label: 'Size or setting (e.g. 250 m², garden)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'nameAm',
			label: 'Name (Amharic)',
			type: 'text',
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
			name: 'youtubeUrl',
			label: 'YouTube video link (watch, youtu.be or Shorts)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'summary',
			label: 'Summary (on the card)',
			type: 'textarea',
			rows: 2,
			required: false,
			inTable: false
		},
		{
			name: 'summaryAm',
			label: 'Summary (Amharic)',
			type: 'textarea',
			rows: 2,
			required: false,
			inTable: false
		},
		{
			name: 'description',
			label: 'About the space',
			type: 'textarea',
			rows: 5,
			required: false,
			inTable: false
		},
		{
			name: 'descriptionAm',
			label: 'About the space (Amharic)',
			type: 'textarea',
			rows: 5,
			required: false,
			inTable: false
		},
		{
			name: 'features',
			label: 'What comes with it (one item per line)',
			type: 'textarea',
			rows: 5,
			required: false,
			inTable: false
		},
		{
			name: 'featuresAm',
			label: 'What comes with it, in Amharic (one item per line)',
			type: 'textarea',
			rows: 5,
			required: false,
			inTable: false
		},
		{
			name: 'sortOrder',
			label: 'Order on the spaces page (lower first)',
			type: 'number',
			required: false,
			inTable: false
		},
		{ name: 'status', label: 'On offer', type: 'boolean' }
	];
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Rental spaces"
		tabTitle="Rental spaces | Amoria"
		description="Halls, gardens and rooms Amoria rents out for events. Guests see them at /spaces and ask to book by chat or phone. Open a space to add its photo gallery and see its video."
	/>
	<LookupPage
		{data}
		schemas={{ add: spaceAdd, edit: spaceEdit }}
		config={{ entity: 'Space', plural: 'Spaces', fields, extraColumns }}
	/>
</div>
