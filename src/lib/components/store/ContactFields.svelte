<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { m } from '$lib/paraglide/messages.js';

	type Props = {
		/** The superforms `$form`/`$errors` stores of a form with `name`, `phone` and `email`. */
		form: ComponentProps<typeof InputComp>['form'];
		errors: ComponentProps<typeof InputComp>['errors'];
		/** What we do with the number, in the words of the page (an order, a course…). */
		phoneHint?: string;
	};

	let { form, errors, phoneHint }: Props = $props();
</script>

<!-- Name and phone, then an optional email: everything a guest is asked before paying (§12.3). -->
<InputComp {form} {errors} name="name" label={m.checkout_name()} required />
<InputComp
	{form}
	{errors}
	name="phone"
	type="tel"
	label={m.checkout_phone()}
	placeholder="0911 234 567"
	description={phoneHint ?? m.checkout_phone_hint()}
	required
/>
<InputComp {form} {errors} name="email" type="email" label={m.checkout_email()} />
