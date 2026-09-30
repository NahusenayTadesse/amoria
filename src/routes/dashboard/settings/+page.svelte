<script lang="ts">
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { shopSettingsSchema } from '$lib/schemas/catalog';
	import SettingsTabs from './SettingsTabs.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, shopSettingsSchema, {
		resetForm: false
	});
</script>

<svelte:head><title>Shop settings | Amoria</title></svelte:head>

<div class="flex flex-col gap-4">
	<SettingsTabs current="shop" />
	<form method="POST" use:enhance class="grid max-w-3xl gap-4">
		<FormCard title="Checkout" description="How long unpaid orders keep their stock, and delivery.">
			<div class="grid gap-4 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					name="holdMinutes"
					type="number"
					min="5"
					label="Hold unpaid orders for (minutes)"
					description="Stock goes back on the shelf after this."
				/>
				<InputComp
					{form}
					{errors}
					name="lowStockDefault"
					type="number"
					min="0"
					label="Warn about low stock at"
					description="For products without their own number."
				/>
				<InputComp
					{form}
					{errors}
					name="freeDeliveryThreshold"
					type="number"
					min="0"
					label="Free delivery from (ETB)"
					description="0 turns free delivery off."
				/>
				<InputComp
					{form}
					{errors}
					name="freeDeliverySuggestAt"
					type="number"
					min="0"
					label="Start nudging from (ETB)"
					description="Above this the bag says how much more makes delivery free."
				/>
			</div>
			<!-- A native checkbox: it posts `on` when ticked, which superforms reads as true, and nothing when not. -->
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					name="deliveryEnabled"
					bind:checked={$form.deliveryEnabled}
					class="size-4 accent-primary"
				/>
				Offer delivery at checkout (needs at least one delivery area)
			</label>
		</FormCard>

		<FormCard title="Contact" description="Shown to customers.">
			<div class="grid gap-4 sm:grid-cols-2">
				<InputComp {form} {errors} name="businessPhone" type="tel" label="Shop phone" />
				<InputComp {form} {errors} name="whatsappNumber" type="tel" label="WhatsApp number" />
				<InputComp {form} {errors} name="telegramUsername" label="Telegram username" />
				<InputComp {form} {errors} name="address" label="Address" />
			</div>
		</FormCard>

		<Button type="submit" class="justify-self-start">
			{#if $delayed}<LoadingBtn name="Saving" />{:else}Save settings{/if}
		</Button>
	</form>
</div>
