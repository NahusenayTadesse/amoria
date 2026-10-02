<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Award from '@lucide/svelte/icons/award';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDate, ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import {
		REGISTRATION_ACTION_LABELS,
		REGISTRATION_PAID,
		REGISTRATION_STATUS_LABELS,
		REGISTRATION_TRANSITIONS
	} from '$lib/registrationStatus';
	import { quick } from '$lib/quick';
	import PaymentsCard from '$lib/components/dashboard/PaymentsCard.svelte';

	let { data } = $props();

	const reg = $derived(data.registration);
	const nextSteps = $derived(REGISTRATION_TRANSITIONS[reg.status]);
	const waitingReceipts = $derived(
		data.payments.filter((p) => p.provider === 'bank_transfer' && p.status === 'initiated')
	);
	const day = (value: string) => ethiopianDate(new Date(`${value}T12:00:00+03:00`));

	const RESULT_LABELS = {
		pending: 'Not marked yet',
		graduated: 'Graduated',
		not_graduated: 'Did not graduate'
	} as const;
	const RESULT_BUTTONS = [
		{ to: 'graduated', label: 'Graduated: issue certificate' },
		{ to: 'not_graduated', label: 'Did not graduate' },
		{ to: 'pending', label: 'Clear the result' }
	] as const;

	function confirmCancel(event: SubmitEvent) {
		const paid = REGISTRATION_PAID.includes(reg.status);
		const text = paid
			? 'Cancel this paid registration? The seat is released. Refund the student yourself.'
			: 'Cancel this registration? The seat is released.';
		if (!window.confirm(text)) event.preventDefault();
	}
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		eyebrow="Registration"
		title={reg.ref ?? `#${reg.id}`}
		tabTitle="{reg.ref ?? `Registration ${reg.id}`} | Amoria"
	>
		{#snippet badges()}
			<Statuses status={reg.status} label={REGISTRATION_STATUS_LABELS[reg.status]} />
			{#if waitingReceipts.length}
				<Statuses status="initiated" label="Receipt to check" />
			{/if}
		{/snippet}
		<a
			href={resolve('/dashboard/school/students')}
			class="text-sm text-muted-foreground hover:underline">All students</a
		>
	</PageHeader>

	<!-- What can happen next, as buttons; the server enforces the same table. -->
	{#if nextSteps.length}
		<div class="flex flex-wrap gap-2">
			{#each nextSteps as to (to)}
				<form
					method="POST"
					action="?/status"
					use:enhance={quick}
					onsubmit={to === 'cancelled' ? confirmCancel : undefined}
				>
					<input type="hidden" name="to" value={to} />
					<Button type="submit" variant={to === 'cancelled' ? 'outline' : 'default'} size="sm">
						{REGISTRATION_ACTION_LABELS[to] ?? to}
					</Button>
				</form>
			{/each}
		</div>
	{/if}
	{#if reg.status === 'paid_unfulfillable'}
		<Notice tone="warning">
			The payment arrived after the seat was released and the class filled up meanwhile. Call the
			student to move them to another class (raise this class's max students, then "Give a seat"),
			or refund them and cancel.
		</Notice>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header><Card.Title>Student</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-3 text-sm">
				<div>
					<p class="font-medium">{reg.contactName}</p>
					<a class="text-primary hover:underline" href="tel:{reg.contactPhone}"
						>{reg.contactPhone}</a
					>
					{#if reg.contactEmail}<p class="text-muted-foreground">{reg.contactEmail}</p>{/if}
				</div>
				<p class="text-muted-foreground">Registered {ethiopianDateTime(reg.createdAt)}</p>
				{#if reg.status === 'pending_payment' && reg.holdExpiresAt}
					<p class="text-muted-foreground">
						Seat held until {ethiopianDateTime(reg.holdExpiresAt)}
					</p>
				{:else if reg.status === 'pending_payment'}
					<p class="text-muted-foreground">Seat held while a receipt is checked</p>
				{/if}
				{#if reg.paidAt}
					<p class="text-muted-foreground">Paid {ethiopianDateTime(reg.paidAt)}</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Course and class</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-3 text-sm">
				<a
					class="text-base font-medium text-primary hover:underline"
					href={resolve('/dashboard/school/[id]', { id: String(data.course.id) })}
				>
					{data.course.title}
				</a>
				<p class="flex items-start gap-2">
					<CalendarDays class="mt-0.5 size-4 shrink-0" />
					<span>
						From {day(data.intake.startDate)}{data.intake.endDate
							? `, to ${day(data.intake.endDate)}`
							: ''}
						{#if data.intake.shiftName}
							<span class="block text-muted-foreground">{data.intake.shiftName} shift</span>
						{/if}
						{#if data.intake.scheduleText}
							<span class="block text-muted-foreground">{data.intake.scheduleText}</span>
						{/if}
					</span>
				</p>
				<p>
					{data.intake.taken} of {data.intake.seatLimit} seats taken or held.
					<a
						class="text-primary hover:underline"
						href={resolve(
							`/dashboard/school/students?intake=${data.intake.id}&queue=all` as '/dashboard/school/students'
						)}>See this class's students</a
					>
				</p>
				<p class="font-medium">Fee {formatETB(reg.feeSnapshot)}</p>
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2"
				><Award class="size-5" /> Result and certificate</Card.Title
			>
			<Card.Description>
				Every student who qualifies at the end of the class gets a certificate. Marking one
				graduated issues it; they can print it from their registration link too.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3 text-sm">
			<p>
				Result: <Statuses
					status={reg.result === 'graduated'
						? 'active'
						: reg.result === 'not_graduated'
							? 'inactive'
							: 'pending'}
					label={RESULT_LABELS[reg.result]}
				/>
			</p>
			{#if reg.result === 'graduated' && reg.certificateNo}
				<p>
					Certificate {reg.certificateNo}{reg.certificateIssuedAt
						? `, issued ${ethiopianDateTime(reg.certificateIssuedAt)}`
						: ''}.
					<a
						class="text-primary hover:underline"
						href={resolve('/dashboard/school/students/[id]/certificate', { id: String(reg.id) })}
						>Open and print</a
					>
				</p>
			{/if}
			{#if reg.status !== 'confirmed'}
				<p class="text-muted-foreground">Only a confirmed (paid) student can be given a result.</p>
			{:else if !data.intake.ended}
				<p class="text-muted-foreground">
					The result can be marked from the class's last day, {day(
						data.intake.endDate ?? data.intake.startDate
					)}.
				</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each RESULT_BUTTONS.filter((b) => b.to !== reg.result) as button (button.to)}
						<form method="POST" action="?/result" use:enhance={quick}>
							<input type="hidden" name="result" value={button.to} />
							<Button
								type="submit"
								size="sm"
								variant={button.to === 'graduated' ? 'default' : 'outline'}
							>
								{button.label}
							</Button>
						</form>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<PaymentsCard
		payments={data.payments}
		canRecord={data.canRecord}
		awaitingPayment={reg.status === 'pending_payment'}
		amountDue={reg.feeSnapshot}
		noun="registration"
		paymentForm={data.paymentForm}
		rejectForm={data.rejectForm}
	/>
</div>
