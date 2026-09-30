<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import { bankAccountAdd, bankAccountEdit } from '$lib/schemas/catalog';
	import SettingsTabs from '../SettingsTabs.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Bank accounts | Amoria</title></svelte:head>

<div class="flex flex-col gap-2">
	<SettingsTabs current="accounts" />
	<p class="text-muted-foreground">
		Shown at checkout under "Bank transfer", each with a copy button. Customers choose the one they
		paid into and upload the receipt; you confirm it on the order.
	</p>
	<LookupPage
		{data}
		schemas={{ add: bankAccountAdd, edit: bankAccountEdit }}
		config={{
			entity: 'Account',
			plural: 'Bank accounts',
			fields: [
				{
					name: 'bankName',
					label: 'Bank or wallet',
					type: 'text',
					placeholder: 'Commercial Bank of Ethiopia, Telebirr…'
				},
				{ name: 'accountName', label: 'Account holder', type: 'text' },
				{ name: 'accountNumber', label: 'Account number', type: 'text' },
				{ name: 'sortOrder', label: 'Order in the list', type: 'number', required: false },
				{ name: 'status', label: 'Shown at checkout', type: 'boolean' }
			]
		}}
	/>
</div>
