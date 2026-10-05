<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { quoteRequestSchema } from '$lib/schemas/quote';
	import { CONTACT_CHANNELS } from '$lib/constants';
	import { QUOTE_ENDPOINT, enqueue, flushQueue, requestBackgroundSync } from '$lib/offlineQueue';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import ContactFields from '$lib/components/store/ContactFields.svelte';

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

	const channelLabel = {
		whatsapp: m.quote_channel_whatsapp,
		telegram: m.quote_channel_telegram,
		sms: m.quote_channel_sms,
		email: m.quote_channel_email,
		phone: m.quote_channel_phone
	};

	const field =
		'h-12 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2';
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
/>

<section class="mx-auto max-w-2xl px-4 pb-24 sm:px-8">
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

				<div>
					<label for="eventTypeId" class={labelClass}>{m.quote_event_type()}</label>
					<select id="eventTypeId" name="eventTypeId" bind:value={$form.eventTypeId} class={field}>
						<option value="">{m.quote_event_type_any()}</option>
						{#each data.events as event (event.id)}
							<option value={event.id}>{localized(event, 'name')}</option>
						{/each}
					</select>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="eventDate" class={labelClass}>{m.quote_date()}</label>
						<input
							id="eventDate"
							name="eventDate"
							type="date"
							bind:value={$form.eventDate}
							aria-invalid={$errors.eventDate ? 'true' : undefined}
							class={field}
						/>
						{#if $errors.eventDate}
							<p class="mt-1 text-sm text-destructive">{$errors.eventDate}</p>
						{/if}
					</div>
					<div>
						<label for="guestCount" class={labelClass}>{m.quote_guests()}</label>
						<input
							id="guestCount"
							name="guestCount"
							type="number"
							inputmode="numeric"
							min="1"
							bind:value={$form.guestCount}
							class={field}
						/>
					</div>
				</div>

				<div>
					<label for="venue" class={labelClass}>{m.quote_venue()}</label>
					<input
						id="venue"
						name="venue"
						type="text"
						placeholder={m.quote_venue_hint()}
						bind:value={$form.venue}
						class={field}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="theme" class={labelClass}>{m.quote_theme()}</label>
						<input
							id="theme"
							name="theme"
							type="text"
							placeholder={m.quote_theme_hint()}
							bind:value={$form.theme}
							class={field}
						/>
					</div>
					<div>
						<label for="budget" class={labelClass}>{m.quote_budget()}</label>
						<input
							id="budget"
							name="budget"
							type="number"
							inputmode="numeric"
							min="0"
							bind:value={$form.budget}
							class={field}
						/>
					</div>
				</div>

				{#if data.packages.length}
					<div>
						<label for="packageId" class={labelClass}>{m.quote_package()}</label>
						<select id="packageId" name="packageId" bind:value={$form.packageId} class={field}>
							<option value="">{m.quote_package_none()}</option>
							{#each data.packages as pack (pack.id)}
								<option value={pack.id}>{localized(pack, 'name')}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div>
					<label for="message" class={labelClass}>{m.quote_message()}</label>
					<textarea
						id="message"
						name="message"
						rows="4"
						bind:value={$form.message}
						class="{field} h-auto py-3"></textarea>
				</div>
			</fieldset>

			<fieldset class="flex flex-col gap-4">
				<legend class="display mb-1 text-xl font-bold">{m.quote_contact()}</legend>
				<ContactFields {form} {errors} />

				<div>
					<label for="preferredChannel" class={labelClass}>{m.quote_channel()}</label>
					<select
						id="preferredChannel"
						name="preferredChannel"
						bind:value={$form.preferredChannel}
						class={field}
					>
						{#each CONTACT_CHANNELS as channel (channel)}
							<option value={channel}>{channelLabel[channel]()}</option>
						{/each}
					</select>
				</div>
			</fieldset>

			<input type="hidden" name="clientRef" value={clientRef} />

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
