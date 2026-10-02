<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { supplierAdd, supplierEdit } from '$lib/schemas/inventory';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Suppliers"
		description="Wholesalers, décor material shops and printers. A delivery cannot be posted without one, and a supplier's lead time helps plan reorders."
	/>
	<LookupPage
		{data}
		schemas={{ add: supplierAdd, edit: supplierEdit }}
		config={{
			entity: 'Supplier',
			plural: 'Suppliers',
			fields: [
				{ name: 'name', label: 'Name', type: 'text' },
				{ name: 'phone', label: 'Phone', type: 'text' },
				{ name: 'email', label: 'Email', type: 'text', required: false, inTable: false },
				{ name: 'address', label: 'Address', type: 'text', required: false, long: true },
				{ name: 'tin', label: 'TIN', type: 'text', required: false, inTable: false },
				{
					name: 'vatRegistered',
					label: 'VAT registered',
					type: 'checkbox',
					required: false,
					trueLabel: 'Yes',
					falseLabel: 'No'
				},
				{
					name: 'leadTimeDays',
					label: 'Lead time (days)',
					type: 'number',
					required: false
				},
				{ name: 'status', label: 'Active', type: 'boolean' }
			]
		}}
	/>
</div>
