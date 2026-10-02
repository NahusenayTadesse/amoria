<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteMap } from 'svelte/reactivity';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import DateInput from '@nahu/admin-kit/formComponents/DateInput.svelte';
	import { ethiopianDate } from '@nahu/admin-kit/tableCells';
	import { quick } from '$lib/quick';
	import {
		addDays,
		classKey,
		courseDays,
		DEFAULT_COURSE_DAYS,
		MAX_PLANNED_CLASSES,
		planRuns
	} from '$lib/schoolPlan';

	type Shift = { id: number; name: string; timeText: string | null };
	type Props = {
		/** The course's own length in days; null means the default of 20. */
		durationDays: number | null;
		/** The course's usual class size, suggested for every class. */
		maxStudents: number | null;
		/** Shifts in use. None: each date range is one class. */
		shifts: Shift[];
		/** Classes the course already has, so the plan can say which ones it would repeat. */
		existing: { startDate: string; shiftId: number | null }[];
	};
	let { durationDays, maxStudents, shifts, existing }: Props = $props();

	/**
	 * The class builder: a date range, the course length and the shifts become one class per run
	 * and shift, shown before anything is saved. Each planned class can be left out or given its
	 * own limit; classes that already exist are shown and skipped.
	 */

	// Seeded from the course once; after that the boxes are the admin's. Tomorrow, Addis time.
	let from = $state(addDays(new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10), 1));
	let to = $state('');
	// svelte-ignore state_referenced_locally
	let days = $state<number | null>(durationDays);
	// svelte-ignore state_referenced_locally
	let seats = $state<number | null>(maxStudents);
	// svelte-ignore state_referenced_locally
	let chosenShifts = $state<number[]>(shifts.map((s) => s.id));
	let saveDays = $state(false);

	/** Per-class changes the admin made in the plan, by `classKey`. */
	const skipped = new SvelteMap<string, boolean>();
	const ownSeats = new SvelteMap<string, number>();

	const length = $derived(courseDays(days));
	const lengthChanged = $derived(length !== courseDays(durationDays));
	const existingKeys = $derived(new Set(existing.map((c) => classKey(c.startDate, c.shiftId))));

	const plan = $derived.by(() => {
		const runs = planRuns(from, to, length);
		const lanes: (Shift | null)[] = shifts.length
			? shifts.filter((s) => chosenShifts.includes(s.id))
			: [null];
		return runs.flatMap((run) =>
			lanes.map((shift) => {
				const key = classKey(run.startDate, shift?.id ?? null);
				return {
					key,
					...run,
					shift,
					exists: existingKeys.has(key),
					seatLimit: ownSeats.get(key) ?? seats ?? 0
				};
			})
		);
	});

	const toCreate = $derived(plan.filter((c) => !c.exists && !skipped.get(c.key)));
	const missingSeats = $derived(toCreate.some((c) => !c.seatLimit || c.seatLimit < 1));

	const payload = $derived(
		JSON.stringify(
			toCreate.map((c) => ({
				startDate: c.startDate,
				endDate: c.endDate,
				shiftId: c.shift?.id ?? null,
				seatLimit: c.seatLimit
			}))
		)
	);

	/** A day shown the way the dashboard shows them, with the Gregorian date beside it. */
	const show = (day: string) => {
		const [y, m, d] = day.split('-');
		return `${ethiopianDate(new Date(`${day}T12:00:00+03:00`))} (${d}/${m}/${y})`;
	};

	function toggleShift(id: number, on: boolean) {
		chosenShifts = on ? [...chosenShifts, id] : chosenShifts.filter((s) => s !== id);
	}

	const onDone = () => {
		const handle = quick();
		return async (input: {
			result: { type: string; data?: Record<string, unknown> };
			update: (options?: { reset?: boolean }) => Promise<void>;
		}) => {
			if (input.result.type === 'success') {
				skipped.clear();
				ownSeats.clear();
			}
			// Keep the range, length and size typed above: a native reset would empty them.
			await handle({ ...input, update: () => input.update({ reset: false }) });
		};
	};
</script>

<form method="POST" action="?/buildClasses" use:enhance={onDone} class="flex flex-col gap-5">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="flex flex-col gap-1.5">
			<label for="builder-from" class="text-sm font-medium">First class starts</label>
			<DateInput
				id="builder-from"
				name="from"
				bind:value={from}
				oldDays={false}
				allowEmpty={false}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="builder-to" class="text-sm font-medium">Last class ends by</label>
			<DateInput id="builder-to" name="to" bind:value={to} oldDays={false} />
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="builder-days" class="text-sm font-medium">Days per class</label>
			<Input
				id="builder-days"
				type="number"
				min="1"
				max="365"
				placeholder={String(DEFAULT_COURSE_DAYS)}
				bind:value={days}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="builder-seats" class="text-sm font-medium">Max students per class</label>
			<Input id="builder-seats" type="number" min="1" max="500" bind:value={seats} />
		</div>
	</div>

	{#if shifts.length}
		<fieldset class="flex flex-wrap items-center gap-x-5 gap-y-2">
			<legend class="mb-2 text-sm font-medium">Shifts (one class per shift)</legend>
			{#each shifts as shift (shift.id)}
				<label class="inline-flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="size-4 accent-primary"
						checked={chosenShifts.includes(shift.id)}
						onchange={(e) => toggleShift(shift.id, e.currentTarget.checked)}
					/>
					{shift.name}{#if shift.timeText}<span class="text-muted-foreground"
							>({shift.timeText})</span
						>{/if}
				</label>
			{/each}
		</fieldset>
	{:else}
		<p class="text-sm text-muted-foreground">
			No shifts yet, so each date range is one class. Add Morning, Afternoon and so on under School,
			Shifts, to run the same dates at several times of day.
		</p>
	{/if}

	{#if lengthChanged}
		<label class="inline-flex items-center gap-2 text-sm">
			<input type="checkbox" class="size-4 accent-primary" bind:checked={saveDays} />
			Also make {length} days this course's length
		</label>
	{/if}

	{#if !to}
		<p class="text-sm text-muted-foreground">
			Choose when the last class should end, and the classes fill in here: {length}-day classes, one
			after the other.
		</p>
	{:else if !plan.length}
		<Notice tone="warning">
			The range is shorter than one {length}-day class{shifts.length && !chosenShifts.length
				? ', or no shift is chosen'
				: ''}.
		</Notice>
	{:else}
		<div class="overflow-x-auto rounded-md border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-left">
					<tr>
						<th class="w-10 p-2"><span class="sr-only">Create</span></th>
						<th class="p-2 font-medium">Dates</th>
						<th class="p-2 font-medium">Shift</th>
						<th class="w-36 p-2 font-medium">Max students</th>
					</tr>
				</thead>
				<tbody>
					{#each plan as c (c.key)}
						<tr class={['border-t', (c.exists || skipped.get(c.key)) && 'text-muted-foreground']}>
							<td class="p-2">
								<input
									type="checkbox"
									class="size-4 accent-primary"
									aria-label="Create the class starting {c.startDate}"
									disabled={c.exists}
									checked={!c.exists && !skipped.get(c.key)}
									onchange={(e) => skipped.set(c.key, !e.currentTarget.checked)}
								/>
							</td>
							<td class="p-2">
								{show(c.startDate)} to {show(c.endDate)}
								{#if c.exists}<span class="ml-1 text-xs">(already exists)</span>{/if}
							</td>
							<td class="p-2">{c.shift?.name ?? 'Single class'}</td>
							<td class="p-2">
								<Input
									type="number"
									min="1"
									max="500"
									class="h-8"
									aria-label="Max students for the class starting {c.startDate}"
									disabled={c.exists || skipped.get(c.key)}
									value={c.seatLimit || ''}
									oninput={(e) => ownSeats.set(c.key, Number(e.currentTarget.value))}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<input type="hidden" name="classes" value={payload} />
	{#if saveDays && lengthChanged}<input type="hidden" name="saveDays" value={length} />{/if}

	<div class="flex flex-wrap items-center gap-3">
		<Button
			type="submit"
			disabled={!toCreate.length || missingSeats || toCreate.length > MAX_PLANNED_CLASSES}
		>
			Create {toCreate.length} class{toCreate.length === 1 ? '' : 'es'}
		</Button>
		{#if missingSeats}
			<span class="text-sm text-destructive">Give every class a number of students.</span>
		{:else if toCreate.length > MAX_PLANNED_CLASSES}
			<span class="text-sm text-destructive">At most {MAX_PLANNED_CLASSES} at a time.</span>
		{/if}
	</div>
</form>
