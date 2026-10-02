<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Check from '@lucide/svelte/icons/check';
	import { m } from '$lib/paraglide/messages.js';
	import { bothCalendarsOnDay, localized } from '$lib/localized';
	import type { DateRange } from '$lib/schoolPlan';
	import type { SchoolIntake } from '$lib/server/services/school';
	import SeatsLeft from './SeatsLeft.svelte';

	type Props = {
		/** The next date ranges, each with its classes (one per shift). */
		ranges: DateRange<SchoolIntake>[];
		/** Days one class lasts. */
		days: number;
		/** The chosen class's id, posted as `name`. */
		value?: number;
		name?: string;
		error?: string[] | string;
	};
	let { ranges, days, value = $bindable(), name = 'intakeId', error }: Props = $props();

	/** A class's label: its shift in the guest's language, or "Class" for a single-shift course. */
	const shiftLabel = (c: SchoolIntake) =>
		c.shiftName
			? localized({ name: c.shiftName, nameAm: c.shiftNameAm }, 'name')
			: m.school_class();
</script>

<!--
	The date ranges as cards, their shifts as radio buttons: a class with no place left is shown
	(so the guest can see the morning is taken) but cannot be picked.
-->
<fieldset class="flex flex-col gap-4" aria-describedby={error ? `${name}-error` : undefined}>
	<legend class="sr-only">{m.reg_pick_heading()}</legend>
	{#each ranges as range (range.startDate)}
		{@const full = range.seatsLeft <= 0}
		<div
			class={[
				'rounded-[1.5rem] border bg-card p-5 transition-colors',
				range.classes.some((c) => c.id === value) ? 'border-[var(--am-ribbon)]' : 'border-border',
				full && 'opacity-70'
			]}
		>
			<div class="flex flex-wrap items-start justify-between gap-2">
				<p class="flex items-start gap-2.5">
					<CalendarDays class="mt-1 h-4 w-4 shrink-0 text-[var(--am-ribbon)]" aria-hidden="true" />
					<span>
						<span class="block font-semibold">
							{range.endDate
								? m.school_range({
										from: bothCalendarsOnDay(range.startDate),
										to: bothCalendarsOnDay(range.endDate)
									})
								: bothCalendarsOnDay(range.startDate)}
						</span>
						<span class="text-sm text-muted-foreground">{m.school_days({ days })}</span>
					</span>
				</p>
				{#if full}
					<span
						class="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground"
					>
						{m.reg_range_full()}
					</span>
				{/if}
			</div>

			<div class="mt-4 grid gap-2 sm:grid-cols-2">
				{#each range.classes as c (c.id)}
					{@const disabled = c.seatsLeft <= 0}
					{@const checked = value === c.id}
					<label
						class={[
							'relative flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors',
							disabled
								? 'cursor-not-allowed border-dashed border-border bg-secondary/50'
								: 'cursor-pointer border-border hover:border-foreground/50',
							checked && 'border-[var(--am-ribbon)] bg-[#fbe4ee]/50 ring-1 ring-[var(--am-ribbon)]'
						]}
					>
						<input
							type="radio"
							class="peer sr-only"
							{name}
							value={c.id}
							{disabled}
							{checked}
							onchange={() => (value = c.id)}
						/>
						<span class="min-w-0">
							<span class={['block font-semibold', disabled && 'text-muted-foreground']}>
								{shiftLabel(c)}
							</span>
							{#if c.shiftTime}
								<span class="block text-sm text-muted-foreground">{c.shiftTime}</span>
							{/if}
							{#if c.scheduleText}
								<span class="block text-xs text-muted-foreground">{c.scheduleText}</span>
							{/if}
							<span class="mt-2 block"><SeatsLeft count={c.seatsLeft} /></span>
						</span>
						<span
							class={[
								'grid h-6 w-6 shrink-0 place-items-center rounded-full border',
								checked
									? 'border-[var(--am-ribbon)] bg-[var(--am-ribbon)] text-white'
									: 'border-border',
								'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--am-ribbon)] peer-focus-visible:ring-offset-2'
							]}
							aria-hidden="true"
						>
							{#if checked}<Check class="h-3.5 w-3.5" />{/if}
						</span>
					</label>
				{/each}
			</div>
		</div>
	{/each}
	{#if error}
		<p id="{name}-error" class="text-sm text-destructive" role="alert">
			{Array.isArray(error) ? error[0] : error}
		</p>
	{/if}
</fieldset>
