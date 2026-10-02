<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { locationAdd, locationEdit } from '$lib/schemas/inventory';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Locations"
		description="Where stock sits. Sales take from the shop floor first, then the other places. Stock in quarantine is set aside: it is never sold or issued."
	/>
	<LookupPage
		{data}
		schemas={{ add: locationAdd, edit: locationEdit }}
		config={{
			entity: 'Location',
			plural: 'Locations',
			fields: [
				{ name: 'name', label: 'Name', type: 'text' },
				{
					name: 'kind',
					label: 'Kind',
					type: 'select',
					choices: [
						{ value: 'shop', name: 'Shop floor (sales take from here first)' },
						{ value: 'storage', name: 'Storage' },
						{ value: 'workshop', name: 'Workshop' },
						{ value: 'quarantine', name: 'Quarantine (set aside)' }
					]
				},
				{ name: 'sortOrder', label: 'Order', type: 'number', required: false },
				{ name: 'status', label: 'In use', type: 'boolean' }
			]
		}}
	/>
</div>
