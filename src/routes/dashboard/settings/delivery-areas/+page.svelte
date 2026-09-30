<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import { deliveryAreaAdd, deliveryAreaEdit } from '$lib/schemas/catalog';
	import SettingsTabs from '../SettingsTabs.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Delivery areas | Amoria</title></svelte:head>

<div class="flex flex-col gap-2">
	<SettingsTabs current="areas" />
	<p class="text-muted-foreground">
		The areas customers can pick at checkout, and the fee for each. Orders at or above the
		free-delivery threshold (in Shop settings) pay no fee wherever they go.
	</p>
	<LookupPage
		{data}
		schemas={{ add: deliveryAreaAdd, edit: deliveryAreaEdit }}
		config={{
			entity: 'Delivery area',
			plural: 'Delivery areas',
			fields: [
				{ name: 'name', label: 'Area', type: 'text' },
				{ name: 'nameAm', label: 'Area (Amharic)', type: 'text', required: false },
				{ name: 'fee', label: 'Fee', type: 'money' },
				{ name: 'sortOrder', label: 'Order in the list', type: 'number', required: false },
				{ name: 'status', label: 'Delivering there', type: 'boolean' }
			]
		}}
	/>
</div>
