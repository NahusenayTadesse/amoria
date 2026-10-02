<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { shiftAdd, shiftEdit } from '$lib/schemas/school';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Shifts"
		tabTitle="Shifts | Amoria"
		description="The times of day classes run in, such as Morning or Afternoon. The class builder makes one class per chosen shift, each with its own places, so a student can take the afternoon when the morning is full. With no shifts, each date range is a single class."
	/>
	<LookupPage
		{data}
		schemas={{ add: shiftAdd, edit: shiftEdit }}
		config={{
			entity: 'Shift',
			plural: 'Shifts',
			fields: [
				{ name: 'name', label: 'Name', type: 'text' },
				{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
				{ name: 'timeText', label: 'Hours (e.g. 8:30 to 12:00)', type: 'text', required: false },
				{ name: 'sortOrder', label: 'Order (lower first)', type: 'number', required: false },
				{ name: 'status', label: 'In use', type: 'boolean' }
			]
		}}
	/>
</div>
