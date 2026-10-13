<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import type { SuperValidated } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import DateInput from '@nahu/admin-kit/formComponents/DateInput.svelte';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import { EVENT_TYPE_UNSURE_IMAGE, eventTypeImage } from '$lib/eventTypeImages';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { localized } from '$lib/localized';
	import { spaceBookingSchema, type SpaceBookingInput } from '$lib/schemas/quote';
	import ContactFields from './ContactFields.svelte';
	import ChannelPicker from './ChannelPicker.svelte';

	type Props = {
		/** The page's empty booking form, from `superValidate`. */
		data: SuperValidated<SpaceBookingInput, { type: 'success' | 'error'; text: string }>;
		/** Event kinds to choose from as picture cards (optional for the guest). */
		events: { id: number; slug: string; name: string; nameAm: string | null }[];
		/** The space's name, in the visitor's language. */
		name: string;
	};
	let { data, events, name }: Props = $props();

	let sent = $state(false);

	// Set up once from the page's initial form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data, spaceBookingSchema, {
		resetForm: false,
		onUpdated({ form }) {
			if (form.message?.type === 'success') sent = true;
		}
	});

	const eventItems = $derived([
		...events.map((event) => ({
			value: event.id,
			name: localized(event, 'name'),
			image: eventTypeImage(event.slug)
		})),
		{ value: '', name: m.quote_event_type_unsure(), image: EVENT_TYPE_UNSURE_IMAGE }
	]);

	const labelClass = 'mb-1.5 block text-sm font-medium';
</script>

{#if sent}
	<div class="rounded-[1.5rem] border border-border bg-card p-7 text-center sm:p-10" role="status">
		<CircleCheck class="mx-auto h-10 w-10 text-[var(--am-ribbon)]" aria-hidden="true" />
		<h3 class="display mt-4 text-2xl font-bold">{m.spaces_booked_heading()}</h3>
		<p class="mt-3 text-muted-foreground">{m.spaces_booked_body({ name })}</p>
		<a
			href={resolve(localizeHref('/spaces') as AppPath)}
			class="mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-7 text-sm font-semibold text-background"
		>
			{m.spaces_booked_more()}
		</a>
	</div>
{:else}
	<form
		method="POST"
		action="?/book"
		use:enhance
		class="flex flex-col gap-8 sm:rounded-[1.5rem] sm:border sm:border-border sm:bg-card sm:p-8"
	>
		<fieldset class="flex flex-col gap-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="book-eventDate" class={labelClass}>{m.spaces_book_date()}</label>
					<DateInput
						name="eventDate"
						id="book-eventDate"
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
					id="book-guestCount"
					type="number"
					min={1}
					label={m.quote_guests()}
				/>
			</div>

			{#if events.length}
				<div>
					<p id="book-eventTypeId-label" class={labelClass}>{m.quote_event_type()}</p>
					<ImageSelect
						name="eventTypeId"
						items={eventItems}
						bind:value={$form.eventTypeId}
						labelledBy="book-eventTypeId-label"
					/>
				</div>
			{/if}

			<InputComp
				{form}
				{errors}
				name="message"
				id="book-message"
				type="textarea"
				rows={3}
				label={m.spaces_book_message()}
				placeholder={m.spaces_book_message_hint()}
			/>
		</fieldset>

		<fieldset class="flex flex-col gap-4">
			<legend class="display mb-1 text-xl font-bold">{m.quote_contact()}</legend>
			<ContactFields {form} {errors} idPrefix="book" phoneHint={m.spaces_book_phone_hint()} />

			<div>
				<p id="book-channel-label" class={labelClass}>{m.quote_channel()}</p>
				<ChannelPicker
					name="preferredChannel"
					bind:value={$form.preferredChannel}
					labelledBy="book-channel-label"
				/>
			</div>
		</fieldset>

		<button
			type="submit"
			disabled={$delayed}
			class="btn-shine h-13 w-full rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] disabled:opacity-60 sm:w-auto sm:self-start"
		>
			{$delayed ? m.quote_sending() : m.spaces_book_send()}
		</button>
	</form>
{/if}
