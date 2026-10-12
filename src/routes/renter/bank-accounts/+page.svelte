<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { renterAccountAdd, renterAccountEdit } from '$lib/schemas/renters';

	let { data } = $props();

	const fields: LookupField[] = [
		{ name: 'bankName', label: 'Bank or wallet (e.g. CBE, Awash, Telebirr)', type: 'text' },
		{ name: 'accountName', label: 'Name on the account', type: 'text' },
		{ name: 'accountNumber', label: 'Account or wallet number', type: 'text' },
		{
			name: 'sortOrder',
			label: 'Order shown to customers (lower first)',
			type: 'number',
			required: false,
			inTable: false
		},
		{ name: 'status', label: 'Show to customers', type: 'boolean' }
	];
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Bank accounts"
		tabTitle="Bank accounts | Amoria renters"
		description="Where your customers transfer to. They see these when they pay, copy the number with one tap, and send you the receipt to check. You need at least one before you can take a booking."
	/>
	<LookupPage
		{data}
		schemas={{ add: renterAccountAdd, edit: renterAccountEdit }}
		config={{ entity: 'Account', plural: 'Accounts', fields }}
	/>
</div>
