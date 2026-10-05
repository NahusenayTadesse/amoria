<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { m } from '$lib/paraglide/messages.js';
	import { bothCalendarsOnDay, localized, shortDay } from '$lib/localized';
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

	/** The range whose shifts are showing: the chosen class's, else the first with a place. */
	// Starts on the chosen class's range; after that the guest's own tabs decide.
	// svelte-ignore state_referenced_locally
	let activeStart = $state(
		(
			ranges.find((r) => r.classes.some((c) => c.id === value)) ??
			ranges.find((r) => r.seatsLeft > 0) ??
			ranges[0]
		)?.startDate
	);
	const active = $derived(ranges.find((r) => r.startDate === activeStart));

	/** A class's label: its shift in the guest's language, or "Class" for a single-shift course. */
	const shiftLabel = (c: SchoolIntake) =>
		c.shiftName
			? localized({ name: c.shiftName, nameAm: c.shiftNameAm }, 'name')
			: m.school_class();

	/** Picking a different range clears a class chosen in another, so nothing hidden is posted. */
	function showRange(start: string) {
		activeStart = start;
		const keep = ranges.find((r) => r.startDate === start)?.classes.some((c) => c.id === value);
		if (!keep) value = undefined;
	}
</script>

<!--
	Two steps in one small space: the date ranges as chips along a row, then the chosen range's
	shifts as cards. A class with no place left is shown (so the guest can see the morning is taken)
	but cannot be picked. The posted value is the hidden input, so only what is chosen is sent.
-->
<fieldset
	class="flex min-w-0 flex-col gap-4"
	aria-describedby={error ? `${name}-error` : undefined}
>
	<legend class="sr-only">{m.reg_pick_heading()}</legend>
	<input type="hidden" {name} value={value ?? ''} />

	<div
		role="tablist"
		aria-label={m.reg_pick_heading()}
		class="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
	>
		{#each ranges as range (range.startDate)}
			{@const full = range.seatsLeft <= 0}
			{@const selected = range.startDate === activeStart}
			<button
				type="button"
				role="tab"
				aria-selected={selected}
				onclick={() => showRange(range.startDate)}
				class={[
					'flex min-h-14 shrink-0 flex-col items-start justify-center rounded-2xl border px-4 text-left transition-colors active:scale-[0.98]',
					selected
						? 'border-[var(--am-ribbon)] bg-[var(--am-ribbon)] text-white'
						: 'border-border bg-card',
					full && !selected && 'opacity-60'
				]}
			>
				<span class="text-sm font-semibold whitespace-nowrap">
					{shortDay(range.startDate)}{range.endDate ? ` – ${shortDay(range.endDate)}` : ''}
				</span>
				<span class={['text-xs', selected ? 'text-white/80' : 'text-muted-foreground']}>
					{full ? m.reg_range_full() : m.school_days({ days })}
				</span>
			</button>
		{/each}
	</div>

	{#if active}
		<div class="rounded-[1.25rem] border border-border bg-card p-4" role="tabpanel">
			<p class="text-sm text-muted-foreground">
				{active.endDate
					? m.school_range({
							from: bothCalendarsOnDay(active.startDate),
							to: bothCalendarsOnDay(active.endDate)
						})
					: bothCalendarsOnDay(active.startDate)}
			</p>

			<div class="mt-3 grid gap-2 sm:grid-cols-2">
				{#each active.classes as c (c.id)}
					{@const disabled = c.seatsLeft <= 0}
					{@const checked = value === c.id}
					<label
						class={[
							'relative flex min-h-16 items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors',
							disabled
								? 'cursor-not-allowed border-dashed border-border bg-secondary/50'
								: 'cursor-pointer border-border hover:border-foreground/50 active:bg-secondary',
							checked && 'border-[var(--am-ribbon)] bg-[#e6f1e9]/50 ring-1 ring-[var(--am-ribbon)]'
						]}
					>
						<input
							type="radio"
							class="peer sr-only"
							name="{name}-shift"
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
	{/if}
	{#if error}
		<p id="{name}-error" class="text-sm text-destructive" role="alert">
			{Array.isArray(error) ? error[0] : error}
		</p>
	{/if}
</fieldset>
