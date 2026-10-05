<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Lock from '@lucide/svelte/icons/lock';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { birr, bothCalendarsOnDay, localized, shortDay } from '$lib/localized';
	import { registrationSchema } from '$lib/schemas/school';
	import ContactFields from '$lib/components/store/ContactFields.svelte';
	import PaymentMethodFields from '$lib/components/store/PaymentMethodFields.svelte';
	import ClassPicker from '$lib/components/store/ClassPicker.svelte';
	import SeatsLeft from '$lib/components/store/SeatsLeft.svelte';

	let { data } = $props();

	const course = $derived(data.course);
	const title = $derived(localized(course, 'title'));
	const open = $derived(data.ranges.some((range) => range.seatsLeft > 0));
	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	// Set up once from the page's initial form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, registrationSchema, {
		// A receipt is a file, so the form posts as multipart and superforms must not turn it into JSON.
		dataType: 'form',
		resetForm: false,
		onUpdated({ form }) {
			const result = form.message;
			// Validation or a refusal: stay on the page.
			if (!result?.statusPath) return;

			// From here the registration exists, paid or not.
			if (result.checkoutUrl) {
				// Chapa's page is another site: a full navigation, which `goto` refuses to do.
				window.location.href = result.checkoutUrl;
			} else {
				goto(path(result.statusPath));
			}
		}
	});

	/** The class picked above, with its date range, for the summary. */
	const chosen = $derived.by(() => {
		for (const range of data.ranges) {
			const found = range.classes.find((c) => c.id === $form.intakeId);
			if (found) return found;
		}
		return null;
	});
	const chosenShift = $derived(
		chosen?.shiftName
			? localized({ name: chosen.shiftName, nameAm: chosen.shiftNameAm }, 'name')
			: null
	);
</script>

<svelte:head>
	<title>{open ? m.reg_meta_title({ course: title }) : m.reg_unavailable_heading()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 pt-6 pb-36 sm:px-8 sm:pt-12 lg:pb-24">
	{#if !open}
		<div class="mx-auto max-w-xl py-16 text-center">
			<h1 class="display text-3xl font-bold sm:text-4xl">{m.reg_unavailable_heading()}</h1>
			<p class="mt-4 text-muted-foreground">{m.reg_no_classes()}</p>
			<a
				href={path(`/school/${course.slug}`)}
				class="mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-7 text-sm font-semibold text-background"
			>
				{title}
			</a>
		</div>
	{:else}
		<a
			href={path(`/school/${course.slug}`)}
			class="rise group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
			style="--i: 0"
		>
			<ArrowLeft
				class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
				aria-hidden="true"
			/>
			{title}
		</a>

		<h1 class="display mt-5 text-3xl leading-[1.08] font-bold sm:text-5xl">
			<span class="line"
				><span class="line-in" style="--i: 1">{m.reg_heading({ course: title })}</span></span
			>
		</h1>
		<p class="rise mt-3 max-w-[52ch] text-muted-foreground" style="--i: 3">{m.reg_intro()}</p>

		<div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
			<form
				id="register-form"
				method="POST"
				action="?/register"
				enctype="multipart/form-data"
				use:enhance
				class="rise order-2 flex min-w-0 flex-col gap-6 lg:order-1"
				style="--i: 4"
			>
				<section class="flex flex-col gap-4">
					<div>
						<h2 class="display text-xl font-bold">{m.reg_pick_heading()}</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							{m.reg_pick_hint({ days: course.days })}
						</p>
					</div>
					<ClassPicker
						ranges={data.ranges}
						days={course.days}
						bind:value={$form.intakeId}
						error={$errors.intakeId}
					/>
				</section>

				<section class="flex flex-col gap-4">
					<h2 class="display text-xl font-bold">{m.reg_details()}</h2>
					<ContactFields {form} {errors} phoneHint={m.reg_phone_hint()} />
				</section>

				<section class="flex flex-col gap-5">
					<PaymentMethodFields {form} {errors} accounts={data.accounts} total={course.fee} />
				</section>

				<div class="max-lg:hidden">
					<button
						type="submit"
						disabled={$delayed || !chosen || chosen.seatsLeft <= 0}
						class="btn-shine h-13 w-full rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 enabled:hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto"
					>
						{#if $delayed}
							{m.reg_registering()}…
						{:else if $form.method === 'transfer'}
							{m.reg_send_receipt()}
						{:else}
							{m.checkout_pay_chapa({ total: birr(course.fee) })}
						{/if}
					</button>
					<p class="mt-3 text-sm text-muted-foreground">
						{$form.method === 'transfer' ? m.reg_next_transfer() : m.reg_next_chapa()}
					</p>
				</div>
			</form>

			<!-- The seat, as it will be held: what, when, how much, and for how long. -->
			<aside class="order-1 max-lg:hidden lg:order-2">
				<div
					class="rise summary sticky top-24 overflow-hidden rounded-[1.75rem] border border-border bg-card p-6 sm:p-7"
					style="--i: 3"
				>
					<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase">
						{m.reg_summary()}
					</p>
					<p class="display mt-2 text-2xl leading-tight font-bold">{title}</p>

					<p class="mt-4 flex items-start gap-2.5 text-sm">
						<CalendarDays
							class="mt-0.5 h-4 w-4 shrink-0 text-[var(--am-ribbon)]"
							aria-hidden="true"
						/>
						{#if chosen}
							<span>
								<span class="font-semibold"
									>{m.school_starts()}: {bothCalendarsOnDay(chosen.startDate)}</span
								>
								{#if chosen.endDate}
									<span class="block text-muted-foreground"
										>{m.school_ends()}: {bothCalendarsOnDay(chosen.endDate)}</span
									>
								{/if}
								{#if chosenShift}
									<span class="block text-muted-foreground"
										>{m.reg_shift()}: {chosenShift}{chosen.shiftTime
											? `, ${chosen.shiftTime}`
											: ''}</span
									>
								{/if}
							</span>
						{:else}
							<span class="text-muted-foreground">{m.reg_class_none_chosen()}</span>
						{/if}
					</p>

					{#if chosen}
						<div class="mt-4"><SeatsLeft count={chosen.seatsLeft} /></div>
					{/if}

					<div class="mt-6 flex items-baseline justify-between border-t border-border pt-4">
						<span class="text-sm text-muted-foreground">{m.reg_fee()}</span>
						<span class="display text-2xl font-bold tabular-nums">{birr(course.fee)}</span>
					</div>
					<p class="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
						<Lock class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						{m.reg_hold({ minutes: data.holdMinutes })}
					</p>
				</div>
			</aside>
		</div>
	{/if}
</div>

{#if open}
	<!-- Phones: the fee and the pay button stay in reach, where the summary card is on wide screens. -->
	<div
		class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
	>
		<div class="min-w-0 flex-1 leading-tight">
			<p class="truncate text-sm font-semibold">
				{#if chosen}
					{shortDay(chosen.startDate)}{chosenShift ? ` · ${chosenShift}` : ''}
				{:else}
					<span class="text-muted-foreground">{m.reg_class_none_chosen()}</span>
				{/if}
			</p>
			<p class="display text-lg font-bold tabular-nums">{birr(course.fee)}</p>
		</div>
		<button
			type="submit"
			form="register-form"
			disabled={$delayed || !chosen || chosen.seatsLeft <= 0}
			class="h-12 shrink-0 rounded-full bg-[var(--am-ribbon)] px-6 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
		>
			{#if $delayed}
				{m.reg_registering()}…
			{:else if $form.method === 'transfer'}
				{m.reg_send_receipt()}
			{:else}
				{m.checkout_pay_chapa({ total: birr(course.fee) })}
			{/if}
		</button>
	</div>
{/if}
