<script lang="ts">
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import type { Option } from '$lib/server/options';

	/** The header of a purchase order: shared by the "new" page and the draft's own page. */
	type Props = {
		form: Parameters<typeof InputComp>[1]['form'];
		errors: Parameters<typeof InputComp>[1]['errors'];
		suppliers: Option[];
		locations: Option[];
	};
	let { form, errors, suppliers, locations }: Props = $props();
</script>

<div class="grid gap-4 sm:grid-cols-2">
	<InputComp {form} {errors} name="supplierId" type="select" label="Supplier" items={suppliers} />
	<InputComp {form} {errors} name="locationId" type="select" label="Deliver to" items={locations} />
	<InputComp {form} {errors} name="orderDate" type="date" label="Order date" />
	<InputComp
		{form}
		{errors}
		name="expectedDate"
		type="date"
		label="Expected on"
		required={false}
		allowEmpty
	/>
	<InputComp {form} {errors} name="reference" label="Your reference" required={false} />
</div>
<InputComp {form} {errors} name="note" type="textarea" rows={2} label="Note" required={false} />
