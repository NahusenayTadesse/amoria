<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import * as Sheet from '@nahu/admin-kit/components/ui/sheet/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Truck from '@lucide/svelte/icons/truck';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, localized } from '$lib/localized';
	import { checkoutSchema } from '$lib/schemas/checkout';
	import {
		awayFromFreeDelivery,
		deliveryFee,
		qualifiesForFreeDelivery,
		type FreeDelivery
	} from '$lib/delivery';
	import { sumBirr } from '$lib/money';
	import type { CheckoutMessage } from '../../../routes/(store)/shop/[[category]]/+page.server';
	import { getBag } from './bag.svelte';
	import ContactFields from './ContactFields.svelte';
	import PaymentMethodFields from './PaymentMethodFields.svelte';

	type Account = { id: number; bankName: string; accountName: string; accountNumber: string };
	type Props = {
		open: boolean;
		data: SuperValidated<Record<string, unknown>, CheckoutMessage>;
		accounts: Account[];
		holdMinutes: number;
		delivery: {
			enabled: boolean;
			areas: { id: number; name: string; nameAm: string | null; fee: number }[];
			free: FreeDelivery;
		};
	};

	let { open = $bindable(), data, accounts, holdMinutes, delivery }: Props = $props();

	const bag = getBag();

	/** Three steps, the most a purchase may take (§0 pillar 2): bag, details, pay. */
	let step = $state<1 | 2 | 3>(1);
	const steps = [m.checkout_step_bag, m.checkout_step_details, m.checkout_step_pay];

	// A sheet from the side on wide screens; from the bottom, under the thumb, on phones.
	const wide = new MediaQuery('min-width: 640px');

	// The form is set up once from the page's initial form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, validate } = createForm(data, checkoutSchema, {
		// A receipt is a file, so the form posts as multipart and superforms must not turn it into JSON.
		dataType: 'form',
		resetForm: false,
		onUpdated({ form }) {
			const result = form.message;
			if (!result?.statusPath) {
				// Validation or a refusal: stay. If it was about the details, show that step.
				const detailFields = ['name', 'phone', 'email', 'deliveryAreaId', 'deliveryAddress'];
				if (detailFields.some((field) => field in form.errors)) step = 2;
				return;
			}

			// From here the order exists, paid or not, so the bag has done its job.
			bag.clear();
			open = false;
			step = 1;
			if (result.checkoutUrl) {
				// Chapa's page is another site: a full navigation, which `goto` refuses to do.
				window.location.href = result.checkoutUrl;
			} else {
				goto(resolve(localizeHref(result.statusPath) as AppPath));
			}
		}
	});

	async function toDetails() {
		if (bag.count > 0) step = 2;
	}

	/** Set once the customer tries to leave the details step, so an unchosen area is not an error on arrival. */
	let triedDetails = $state(false);
	const areaError = $derived(triedDetails ? firstError($errors.deliveryAreaId) : undefined);

	async function toPayment() {
		triedDetails = true;
		const fields = ['name', 'phone', 'email'] as const;
		const deliveryFields = ['deliveryAreaId', 'deliveryAddress'] as const;
		const results = await Promise.all(
			[...fields, ...(delivering ? deliveryFields : [])].map((field) => validate(field))
		);
		if (results.every((fieldErrors) => !fieldErrors?.length)) step = 3;
	}

	const delivering = $derived(delivery.enabled && $form.fulfilment === 'delivery');
	const area = $derived(delivery.areas.find((a) => a.id === Number($form.deliveryAreaId)));
	const areaItems = $derived(
		delivery.areas.map((a) => ({ value: a.id, name: `${localized(a, 'name')}, ${birr(a.fee)}` }))
	);
	/** The fee as the server will charge it (same rule, `$lib/delivery`); null until an area is chosen. */
	const fee = $derived(
		delivering ? (area ? deliveryFee(area.fee, bag.total, delivery.free) : null) : 0
	);
	const grandTotal = $derived(sumBirr([bag.total, fee ?? 0]));
	const freeGap = $derived(
		delivery.enabled ? awayFromFreeDelivery(bag.total, delivery.free) : null
	);
	const freeReached = $derived(
		delivery.enabled && qualifiesForFreeDelivery(bag.total, delivery.free)
	);

	/** superforms nests a field's errors differently by type; this reads the first message of any. */
	function firstError(errors: unknown): string | undefined {
		if (Array.isArray(errors)) return errors[0];
		const nested = (errors as { _errors?: string[] } | undefined)?._errors;
		return nested?.[0];
	}
</script>

<!-- fixtec's nudge: how far from free delivery once it is within reach, then that it is free. -->
{#snippet freeDeliveryNote()}
	{#if freeGap !== null}
		<p class="flex items-center gap-2 text-sm text-[var(--am-ribbon)]">
			<Truck class="h-4 w-4 shrink-0" aria-hidden="true" />
			{m.free_delivery_away({ amount: birr(freeGap) })}
		</p>
	{:else if freeReached}
		<p class="flex items-center gap-2 text-sm font-medium text-[#1d5b2c]">
			<Truck class="h-4 w-4 shrink-0" aria-hidden="true" />
			{m.free_delivery_reached()}
		</p>
	{/if}
{/snippet}

<Sheet.Root bind:open>
	<Sheet.Content
		side={wide.current ? 'right' : 'bottom'}
		class={[
			'store flex flex-col gap-0 p-0',
			wide.current ? 'w-full sm:max-w-md' : 'max-h-[92dvh] rounded-t-[1.25rem]'
		]}
	>
		<Sheet.Header class="gap-3 border-b border-border px-5 pt-5 pb-4 text-left">
			<Sheet.Title class="display text-xl font-bold">{m.checkout_title()}</Sheet.Title>
			<Sheet.Description class="sr-only">{m.checkout_step_of({ step })}</Sheet.Description>

			<!-- Where you are in the three steps; each done step can be revisited. -->
			<ol class="grid grid-cols-3 gap-2" aria-label={m.checkout_step_of({ step })}>
				{#each steps as label, index (index)}
					{@const number = (index + 1) as 1 | 2 | 3}
					<li>
						<button
							type="button"
							disabled={number > step}
							onclick={() => (step = number)}
							aria-current={number === step ? 'step' : undefined}
							class="flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
						>
							<span
								class={['h-1 rounded-full', number <= step ? 'bg-[var(--am-ribbon)]' : 'bg-border']}
							></span>
							<span
								class={[
									'text-xs',
									number === step ? 'font-semibold text-foreground' : 'text-muted-foreground'
								]}
							>
								{number}. {label()}
							</span>
						</button>
					</li>
				{/each}
			</ol>
		</Sheet.Header>

		<form
			method="POST"
			action="?/checkout"
			enctype="multipart/form-data"
			use:enhance
			class="flex min-h-0 flex-1 flex-col"
		>
			<!-- The bag goes with the form; the server re-reads every product and price. -->
			<input type="hidden" name="cart" value={bag.toJSON()} />

			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
				<!-- Inactive steps are hidden, not removed, so their fields still post. -->
				<section hidden={step !== 1} class="flex flex-col gap-4">
					{#if bag.items.length === 0}
						<p class="text-sm text-muted-foreground">{m.checkout_bag_empty()}</p>
					{:else}
						<ul class="flex flex-col divide-y divide-border">
							{#each bag.items as item (item.productId)}
								{@const product = item.product}
								{@const name = localized(product, 'name')}
								<li class="flex items-center gap-3 py-3">
									<div class="flex flex-1 flex-col">
										<span class="text-sm font-medium">{name}</span>
										<span class="text-sm text-muted-foreground tabular-nums"
											>{birr(item.total)}</span
										>
									</div>
									<div class="flex items-center rounded-full border border-border">
										<button
											type="button"
											class="grid h-9 w-9 place-items-center"
											aria-label={m.product_decrease({ name })}
											onclick={() => bag.set(product, item.qty - 1)}
										>
											<Minus class="h-3.5 w-3.5" />
										</button>
										<span class="w-6 text-center text-sm tabular-nums">{item.qty}</span>
										<button
											type="button"
											class="grid h-9 w-9 place-items-center disabled:opacity-40"
											aria-label={m.product_increase({ name })}
											disabled={item.qty >= bag.maxFor(product)}
											onclick={() => bag.add(product)}
										>
											<Plus class="h-3.5 w-3.5" />
										</button>
									</div>
									<button
										type="button"
										class="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground"
										aria-label={m.checkout_remove({ name })}
										onclick={() => bag.set(product, 0)}
									>
										<X class="h-4 w-4" />
									</button>
								</li>
							{/each}
						</ul>
						{@render freeDeliveryNote()}
						<div class="rounded-[var(--radius)] bg-secondary p-4 text-sm">
							<p>{delivery.enabled ? m.checkout_fulfilment_note() : m.checkout_pickup_note()}</p>
							<p class="mt-1 text-muted-foreground">
								{m.checkout_hold_note({ minutes: holdMinutes })}
							</p>
						</div>
					{/if}
				</section>

				<section hidden={step !== 2} class="flex flex-col gap-4">
					<ContactFields {form} {errors} />

					{#if delivery.enabled}
						<fieldset class="flex flex-col gap-2">
							<legend class="mb-2 text-sm font-medium">{m.checkout_fulfilment_label()}</legend>
							{#each [{ value: 'pickup', title: m.checkout_pickup(), hint: m.checkout_pickup_hint() }, { value: 'delivery', title: m.checkout_delivery(), hint: m.checkout_delivery_hint() }] as option (option.value)}
								<label
									class={[
										'flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border bg-card p-4 transition-colors',
										$form.fulfilment === option.value
											? 'border-[var(--am-ribbon)] ring-1 ring-[var(--am-ribbon)]'
											: 'border-border hover:border-foreground/40'
									]}
								>
									<input
										type="radio"
										name="fulfilment"
										value={option.value}
										bind:group={$form.fulfilment}
										class="mt-1 accent-[var(--am-ribbon)]"
									/>
									<span class="flex flex-col gap-0.5">
										<span class="text-sm font-semibold">{option.title}</span>
										<span class="text-sm text-muted-foreground">{option.hint}</span>
									</span>
								</label>
							{/each}
						</fieldset>

						{#if delivering}
							<!--
								A native select, not the kit's `SelectComp`: on a phone it opens the system picker,
								and the kit's list is portalled outside this modal sheet, where the dialog hides it
								from screen readers.
							-->
							<div class="flex flex-col gap-2">
								<label for="deliveryAreaId" class="text-sm font-medium"
									>{m.checkout_delivery_area()}</label
								>
								<select
									id="deliveryAreaId"
									name="deliveryAreaId"
									bind:value={$form.deliveryAreaId}
									aria-invalid={areaError ? 'true' : undefined}
									aria-describedby={areaError ? 'deliveryAreaId-error' : undefined}
									class="h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground aria-invalid:border-destructive"
								>
									<option value={undefined} disabled
										>{m.checkout_delivery_area_placeholder()}</option
									>
									{#each areaItems as item (item.value)}
										<option value={item.value}>{item.name}</option>
									{/each}
								</select>
								{#if areaError}
									<p id="deliveryAreaId-error" class="text-sm text-destructive" role="alert">
										{areaError}
									</p>
								{/if}
							</div>
							<InputComp
								{form}
								{errors}
								name="deliveryAddress"
								type="textarea"
								rows={2}
								label={m.checkout_delivery_address()}
								placeholder={m.checkout_delivery_address_placeholder()}
								description={m.checkout_delivery_note()}
								required
							/>
							{@render freeDeliveryNote()}
						{/if}
					{/if}

					<InputComp
						{form}
						{errors}
						name="notes"
						type="textarea"
						rows={2}
						label={m.checkout_notes()}
					/>
				</section>

				<section hidden={step !== 3} class="flex flex-col gap-5">
					<PaymentMethodFields {form} {errors} {accounts} total={grandTotal} />
				</section>
			</div>

			<div
				class="border-t border-border bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
			>
				{#if delivering}
					<dl class="mb-2 flex flex-col gap-1 text-sm text-muted-foreground">
						<div class="flex justify-between">
							<dt>{m.checkout_subtotal()}</dt>
							<dd class="tabular-nums">{birr(bag.total)}</dd>
						</div>
						<div class="flex justify-between">
							<dt>{m.checkout_delivery_fee()}</dt>
							<dd class="tabular-nums">
								{fee === null
									? m.checkout_delivery_choose_area()
									: fee === 0
										? m.checkout_delivery_free()
										: birr(fee)}
							</dd>
						</div>
					</dl>
				{/if}
				<div class="mb-3 flex items-baseline justify-between">
					<span class="text-sm text-muted-foreground">{m.checkout_total()}</span>
					<span class="display text-xl font-bold tabular-nums">{birr(grandTotal)}</span>
				</div>

				<div class="flex gap-2">
					{#if step > 1}
						<button
							type="button"
							onclick={() => (step = (step - 1) as 1 | 2)}
							class="h-12 rounded-full border border-border px-5 text-sm font-semibold"
						>
							{m.checkout_back()}
						</button>
					{/if}

					{#if step === 1}
						<button
							type="button"
							onclick={toDetails}
							disabled={bag.count === 0}
							class="h-12 flex-1 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-40"
						>
							{m.checkout_continue()}
						</button>
					{:else if step === 2}
						<button
							type="button"
							onclick={toPayment}
							class="h-12 flex-1 rounded-full bg-foreground text-sm font-semibold text-background"
						>
							{m.checkout_continue()}
						</button>
					{:else}
						<button
							type="submit"
							disabled={$delayed || bag.count === 0}
							class="h-12 flex-1 rounded-full bg-[var(--am-ribbon)] text-sm font-semibold text-white disabled:opacity-60"
						>
							{#if $delayed}
								{m.checkout_placing()}…
							{:else if $form.method === 'transfer'}
								{m.checkout_send_receipt()}
							{:else}
								{m.checkout_pay_chapa({ total: birr(grandTotal) })}
							{/if}
						</button>
					{/if}
				</div>

				{#if step === 3}
					<p class="mt-3 text-center text-xs text-muted-foreground">
						{$form.method === 'transfer' ? m.checkout_next_transfer() : m.checkout_next_chapa()}
					</p>
				{/if}
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
