<script lang="ts">
	import HiddenField from '@nahu/admin-kit/formComponents/HiddenField.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { birr, localized } from '$lib/localized';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { quoteRequestSchema } from '$lib/schemas/quote';
	import { EVENT_TYPE_UNSURE_IMAGE, eventTypeImage } from '$lib/eventTypeImages';
	import { QUOTE_ENDPOINT, enqueue, flushQueue, requestBackgroundSync } from '$lib/offlineQueue';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import PhotoArt from '$lib/components/store/PhotoArt.svelte';
	import DateInput from '@nahu/admin-kit/formComponents/DateInput.svelte';
	import ContactFields from '$lib/components/store/ContactFields.svelte';
	import ChannelPicker from '$lib/components/store/ChannelPicker.svelte';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';

	let { data } = $props();

	/** `sent`: the server has it. `queued`: saved on this phone, to be sent when back online. */
	let outcome = $state<'sent' | 'queued' | null>(null);
	/** Stands for this request, so sending it twice (queue and retry) still makes one. */
	let clientRef = $state(crypto.randomUUID());

	// Set up once from the page's initial form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, validateForm } = createForm(
		data.form,
		quoteRequestSchema,
		{
			resetForm: false,
			onSubmit({ formData }) {
				formData.set('clientRef', clientRef);
			},
			onUpdated({ form }) {
				if (form.message?.type === 'success') outcome = 'sent';
			},
			onError() {
				// A failed fetch while offline: keep the request instead of losing it.
				if (!navigator.onLine) void keepForLater();
			}
		}
	);

	/** Saves the request in the browser to send when the connection returns. */
	async function keepForLater() {
		const checked = await validateForm({ update: true });
		if (!checked.valid) return;
		await enqueue(QUOTE_ENDPOINT, clientRef, {
			...$form,
			clientRef,
			locale: getLocale()
		});
		await requestBackgroundSync();
		outcome = 'queued';
	}

	/** Submitting with no signal never reaches the server: queue it up front. */
	function submitOffline(event: SubmitEvent) {
		if (navigator.onLine) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		void keepForLater();
	}

	onMount(() => void flushQueue());

	/** Each event type as a picture card, then "Not sure yet" for a request that has none. */
	const eventItems = $derived([
		...data.events.map((event) => ({
			value: event.id,
			name: localized(event, 'name'),
			image: eventTypeImage(event.slug)
		})),
		{ value: '', name: m.quote_event_type_unsure(), image: EVENT_TYPE_UNSURE_IMAGE }
	]);

	const chosenKind = $derived(
		data.events.find((event) => String(event.id) === String($form.eventTypeId ?? ''))
	);
	const chosenPackage = $derived(
		data.packages.find((pack) => String(pack.id) === String($form.packageId ?? ''))
	);

	/**
	 * The chosen kind's packages as picture cards with their starting price, then "None yet". Only
	 * once a kind is chosen: a package with no photo of its own shows its kind's.
	 */
	const packageItems = $derived(
		chosenKind
			? [
					...data.packages
						.filter((pack) => pack.eventTypeId === chosenKind.id)
						.map((pack) => ({
							value: pack.id,
							name: localized(pack, 'name'),
							description: birr(pack.startingPrice),
							image: pack.image ? publicFileUrl(pack.image) : eventTypeImage(chosenKind.slug)
						})),
					{ value: '', name: m.quote_package_none(), image: EVENT_TYPE_UNSURE_IMAGE }
				]
			: []
	);

	/** A new kind drops a package that belongs to another. */
	function setKind(value: typeof $form.eventTypeId) {
		$form.eventTypeId = value;
		if (chosenPackage && String(chosenPackage.eventTypeId) !== String(value ?? '')) {
			$form.packageId = undefined;
		}
	}

	const labelClass = 'mb-1.5 block text-sm font-medium';
</script>

<svelte:head>
	<title>{m.quote_meta_title()}</title>
	<meta name="description" content={m.quote_meta_description()} />
	<meta property="og:title" content={m.quote_meta_title()} />
	<meta property="og:description" content={m.quote_meta_description()} />
</svelte:head>

<PageHero
	kicker={m.quote_kicker()}
	before={m.quote_h1_a()}
	accent={m.quote_h1_b()}
	after={m.quote_h1_c()}
	lede={m.quote_lede()}
>
	{#snippet art()}
		<PhotoArt
			main={{ src: '/images/demo/gallery-garden-reception.webp', w: 900, h: 1350, small: 480 }}
			side={{ src: '/images/demo/gallery-gold-letters.webp', w: 900, h: 1350, small: 480 }}
		/>
	{/snippet}
</PageHero>

<section id="quote-form" class="mx-auto max-w-2xl scroll-mt-24 px-4 pb-24 sm:px-8">
	{#if outcome}
		<div
			class="rounded-[1.5rem] border border-border bg-card p-7 text-center sm:p-10"
			role="status"
		>
			{#if outcome === 'sent'}
				<CircleCheck class="mx-auto h-10 w-10 text-[var(--am-ribbon)]" aria-hidden="true" />
				<h2 class="display mt-4 text-2xl font-bold">{m.quote_sent_heading()}</h2>
				<p class="mt-3 text-muted-foreground">{m.quote_sent_body()}</p>
			{:else}
				<CloudOff class="mx-auto h-10 w-10 text-[var(--am-foil)]" aria-hidden="true" />
				<h2 class="display mt-4 text-2xl font-bold">{m.quote_queued_heading()}</h2>
				<p class="mt-3 text-muted-foreground">{m.quote_queued_body()}</p>
			{/if}
			<a
				href={resolve(localizeHref('/') as AppPath)}
				class="mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-7 text-sm font-semibold text-background"
			>
				{m.quote_sent_home()}
			</a>
		</div>
	{:else}
		<form
			method="POST"
			action="?/request"
			use:enhance
			onsubmitcapture={submitOffline}
			class="flex flex-col gap-8"
		>
			<fieldset class="flex flex-col gap-4">
				<legend class="display mb-1 text-xl font-bold">{m.quote_details()}</legend>

				<!-- The kind of event, then that kind's packages; with a package chosen its kind is settled. -->
				{#if chosenPackage}
					<InputComp {form} {errors} name="eventTypeId" type="hidden" />
					<p class="flex flex-wrap items-center gap-x-2 text-sm">
						<span class="font-medium">{m.quote_event_type()}:</span>
						<span>{chosenKind ? localized(chosenKind, 'name') : ''}</span>
						<button
							type="button"
							onclick={() => ($form.packageId = undefined)}
							class="font-semibold text-[var(--am-ribbon)] underline underline-offset-4"
						>
							{m.quote_event_type_change()}
						</button>
					</p>
				{:else}
					<div>
						<p id="eventTypeId-label" class={labelClass}>{m.quote_event_type()}</p>
						<ImageSelect
							name="eventTypeId"
							items={eventItems}
							bind:value={() => $form.eventTypeId, setKind}
							labelledBy="eventTypeId-label"
						/>
					</div>
				{/if}

				{#if packageItems.length > 1}
					<div>
						<p id="packageId-label" class={labelClass}>{m.quote_package()}</p>
						<ImageSelect
							name="packageId"
							items={packageItems}
							bind:value={$form.packageId}
							labelledBy="packageId-label"
						/>
					</div>
				{/if}

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="eventDate" class={labelClass}>{m.quote_date()}</label>
						<DateInput
							name="eventDate"
							id="eventDate"
							bind:value={$form.eventDate}
							oldDays={false}
							year
						/>
						{#if $errors.eventDate}
							<p class="mt-1 text-sm text-destructive">{$errors.eventDate}</p>
						{/if}
					</div>
					<InputComp
						{form}
						{errors}
						name="guestCount"
						type="number"
						min={1}
						label={m.quote_guests()}
					/>
				</div>

				<InputComp
					{form}
					{errors}
					name="venue"
					label={m.quote_venue()}
					placeholder={m.quote_venue_hint()}
				/>

				<div class="grid gap-4 sm:grid-cols-2">
					<InputComp
						{form}
						{errors}
						name="theme"
						label={m.quote_theme()}
						placeholder={m.quote_theme_hint()}
					/>
					<InputComp {form} {errors} name="budget" type="number" min={0} label={m.quote_budget()} />
				</div>

				<InputComp
					{form}
					{errors}
					name="message"
					type="textarea"
					rows={4}
					label={m.quote_message()}
				/>
			</fieldset>

			<fieldset class="flex flex-col gap-4">
				<legend class="display mb-1 text-xl font-bold">{m.quote_contact()}</legend>
				<ContactFields {form} {errors} />

				<div>
					<p id="preferredChannel-label" class={labelClass}>{m.quote_channel()}</p>
					<ChannelPicker
						name="preferredChannel"
						bind:value={$form.preferredChannel}
						labelledBy="preferredChannel-label"
					/>
				</div>
			</fieldset>

			<HiddenField name="clientRef" value={clientRef} />

			<button
				type="submit"
				disabled={$delayed}
				class="btn-shine h-13 w-full rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] disabled:opacity-60 sm:w-auto"
			>
				{$delayed ? m.quote_sending() : m.quote_send()}
			</button>
		</form>
	{/if}
</section>
