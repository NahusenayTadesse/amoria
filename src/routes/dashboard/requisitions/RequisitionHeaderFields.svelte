<script lang="ts">
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { REQUISITION_PURPOSE_LABELS } from '$lib/stock';
	import type { Option } from '$lib/server/options';

	/** The header of a requisition: shared by the "new" page and the draft's own page. */
	type Props = {
		form: Parameters<typeof InputComp>[1]['form'];
		errors: Parameters<typeof InputComp>[1]['errors'];
		locations: Option[];
		quotes: Option[];
	};
	let { form, errors, locations, quotes }: Props = $props();

	const purposes = Object.entries(REQUISITION_PURPOSE_LABELS).map(([value, name]) => ({
		value,
		name
	}));
</script>

<div class="grid gap-4 sm:grid-cols-2">
	<InputComp
		{form}
		{errors}
		name="requester"
		label="Who is asking"
		placeholder="Wedding crew, Class 4…"
	/>
	<InputComp {form} {errors} name="purpose" type="select" label="What it is for" items={purposes} />
	<InputComp
		{form}
		{errors}
		name="quoteId"
		type="select"
		label="Décor job (if it is for one)"
		items={quotes}
		required={false}
	/>
	<InputComp {form} {errors} name="locationId" type="select" label="Take from" items={locations} />
	<InputComp {form} {errors} name="requestDate" type="date" label="Asked on" />
	<InputComp
		{form}
		{errors}
		name="neededBy"
		type="date"
		label="Needed by"
		required={false}
		allowEmpty
	/>
</div>
<InputComp {form} {errors} name="note" type="textarea" rows={2} label="Note" required={false} />
