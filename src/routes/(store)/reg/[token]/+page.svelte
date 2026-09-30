<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { birr, bothCalendars, bothCalendarsOnDay, bothClocks, localized } from '$lib/localized';
	import ChatButtons from '$lib/components/store/ChatButtons.svelte';
	import PayPanel from '$lib/components/store/PayPanel.svelte';
	import StatusPill from '$lib/components/store/StatusPill.svelte';

	let { data, form: actionData } = $props();

	const reg = $derived(data.registration);
	const title = $derived(
		localized({ name: data.course.title, nameAm: data.course.titleAm }, 'name')
	);

	/** The badge: a submitted receipt reads as its own state, though the seat is still unpaid. */
	const status = $derived.by((): { label: string; tone: 'done' | 'wait' | 'over' } => {
		if (reg.inReview) return { label: m.reg_status_in_review(), tone: 'wait' };
		switch (reg.status) {
			case 'confirmed':
				return { label: m.reg_status_confirmed(), tone: 'done' };
			case 'cancelled':
				return { label: m.reg_status_cancelled(), tone: 'over' };
			case 'expired':
				return { label: m.reg_status_expired(), tone: 'over' };
			case 'paid_unfulfillable':
				return { label: m.reg_status_paid_unfulfillable(), tone: 'wait' };
			default:
				return { label: m.reg_status_pending_payment(), tone: 'wait' };
		}
	});

	/** What has happened and what happens next, in one sentence (§12.3). */
	const now = $derived.by(() => {
		if (reg.inReview) return m.reg_now_review();
		switch (reg.status) {
			case 'pending_payment':
				return reg.holdExpiresAt ? m.reg_now_pending({ time: bothClocks(reg.holdExpiresAt) }) : '';
			case 'confirmed':
				return m.reg_now_confirmed({ phone: reg.phone });
			case 'expired':
				return m.reg_now_expired();
			case 'cancelled':
				return m.reg_now_cancelled();
			case 'paid_unfulfillable':
				return m.reg_now_unfulfillable();
			default:
				return '';
		}
	});

	const canPay = $derived(reg.status === 'pending_payment' && !reg.inReview);

	const notice = $derived.by(() => {
		if (!canPay) return data.paymentNotice === 'paid' ? m.order_payment_paid() : null;
		switch (data.paymentNotice) {
			case 'failed':
				return m.order_payment_failed();
			case 'pending':
				return m.order_payment_pending();
			case 'unavailable':
				return m.order_payment_unavailable();
			default:
				return null;
		}
	});

	const hasChat = $derived(!!(data.contact.whatsapp.trim() || data.contact.telegram.trim()));
</script>

<svelte:head>
	<title>{m.reg_status_meta({ ref: reg.ref })}</title>
	<!-- A student's own registration: never in a search index. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 pt-8 pb-20 sm:px-8 sm:pt-14">
	<p class="text-sm text-muted-foreground">
		{m.reg_registered_on({ date: bothCalendars(reg.createdAt) })}
	</p>
	<div class="mt-2 flex flex-wrap items-center gap-3">
		<h1 class="display text-3xl font-bold sm:text-4xl">{m.reg_status_heading({ ref: reg.ref })}</h1>
		<StatusPill label={status.label} tone={status.tone} />
	</div>

	{#if now}
		<p class="mt-5 text-lg">{now}</p>
	{/if}

	{#if reg.status === 'confirmed'}
		<!-- The one moment worth a flourish: the seat is theirs. -->
		<div
			class="confirmed mt-6 flex items-center gap-4 rounded-[1.5rem] bg-[#e3f1e6] p-5 text-[#1d5b2c]"
		>
			<span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1d5b2c] text-white">
				<GraduationCap class="h-6 w-6" aria-hidden="true" />
			</span>
			<p class="display text-lg font-bold">{title}</p>
		</div>
	{/if}

	<div class="mt-6 rounded-[1.5rem] border border-border bg-card p-5 text-sm">
		<p class="text-xs font-semibold tracking-[0.18em] text-[var(--am-foil)] uppercase">
			{m.reg_course()}
		</p>
		<a
			href={resolve(localizeHref(`/school/${data.course.slug}`) as AppPath)}
			class="display mt-1 block text-xl font-bold hover:underline"
		>
			{title}
		</a>
		<p class="mt-3 flex items-start gap-2.5">
			<CalendarDays class="mt-0.5 h-4 w-4 shrink-0 text-[var(--am-ribbon)]" aria-hidden="true" />
			<span>
				{m.reg_starts({ date: bothCalendarsOnDay(data.course.startDate) })}
				{#if data.course.scheduleText}
					<span class="block text-muted-foreground">{data.course.scheduleText}</span>
				{/if}
			</span>
		</p>
		<div class="mt-4 flex items-baseline justify-between border-t border-border pt-3">
			<span class="font-semibold">{m.reg_fee()}</span>
			<span class="display text-xl font-bold tabular-nums">{birr(reg.fee)}</span>
		</div>
	</div>

	{#if notice}
		<p class="mt-4 rounded-[var(--radius)] border border-border bg-card p-4 text-sm" role="status">
			{notice}
		</p>
	{/if}
	{#if actionData?.error}
		<p
			class="mt-4 rounded-[var(--radius)] border border-destructive/40 bg-card p-4 text-sm text-destructive"
			role="alert"
		>
			{actionData.error}
		</p>
	{/if}

	{#if canPay}
		<PayPanel total={reg.fee} accounts={data.accounts} data={data.transferForm} />
	{/if}

	{#if hasChat}
		<div class="mt-10 flex flex-wrap gap-3">
			<ChatButtons
				whatsapp={data.contact.whatsapp}
				telegram={data.contact.telegram}
				text={m.chat_school_intake({ course: title })}
			/>
		</div>
	{/if}

	<p class="mt-10 text-sm text-muted-foreground">{m.reg_keep_link()}</p>
	<a
		href={resolve(localizeHref('/school') as AppPath)}
		class="mt-2 inline-block text-sm font-semibold text-[var(--am-ribbon)] underline underline-offset-4"
	>
		{m.reg_back_to_school()}
	</a>
</div>

<style>
	.confirmed {
		animation: pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}
	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.94) translateY(8px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.confirmed {
			animation: none;
		}
	}
</style>
