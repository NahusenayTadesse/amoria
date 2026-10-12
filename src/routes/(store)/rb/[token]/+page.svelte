<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { birr, bothCalendars, bothCalendarsOnDay, bothClocks, localized } from '$lib/localized';
	import { orderStatusText, unitText } from '$lib/marketText';
	import { chatHref, telHref } from '$lib/chat';
	import { transferSchema } from '$lib/schemas/checkout';
	import StatusPill from '$lib/components/store/StatusPill.svelte';
	import TransferFields from '$lib/components/store/TransferFields.svelte';

	let { data, form: result } = $props();

	const order = $derived(data.order);
	const renter = $derived(data.renter);
	const renterName = $derived(
		localized({ name: renter.businessName, nameAm: renter.businessNameAm }, 'name')
	);
	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	const tone = $derived(
		['confirmed', 'out', 'completed'].includes(order.status)
			? ('done' as const)
			: ['declined', 'cancelled', 'expired'].includes(order.status)
				? ('over' as const)
				: ('wait' as const)
	);

	/** What has happened, and what comes next, in one sentence. */
	const now = $derived(
		{
			quote_requested: m.rb_now_quote_requested({ renter: renterName }),
			quoted: m.rb_now_quoted(),
			pending_payment: m.rb_now_pending_payment({ renter: renterName }),
			payment_review: m.rb_now_payment_review({ renter: renterName }),
			confirmed: m.rb_now_confirmed(),
			out: m.rb_now_out(),
			completed: m.rb_now_completed(),
			declined: m.rb_now_declined(),
			cancelled: m.rb_now_cancelled(),
			expired: m.rb_now_expired()
		}[order.status]
	);

	const dates = $derived(
		order.endDate && order.endDate !== order.startDate
			? m.school_range({
					from: bothCalendarsOnDay(order.startDate),
					to: bothCalendarsOnDay(order.endDate)
				})
			: bothCalendarsOnDay(order.startDate)
	);
	const canCancel = $derived(
		['quote_requested', 'quoted', 'pending_payment'].includes(order.status)
	);
	const chat = $derived(
		chatHref(
			{ whatsapp: renter.whatsapp ?? '', telegram: renter.telegram ?? '' },
			m.rb_chat_text({ ref: order.ref })
		)
	);
	const call = $derived(telHref(renter.phone));

	// The transfer form, set up once; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const transfer = createForm(data.transferForm, transferSchema, { dataType: 'form' });
	const transferForm = transfer.form;
	const transferErrors = transfer.errors;
	const transferDelayed = transfer.delayed;
	const firstError = (errors: unknown): string | undefined =>
		Array.isArray(errors)
			? errors[0]
			: (errors as { _errors?: string[] } | undefined)?._errors?.[0];

	let busy = $state(false);
	const quick = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external chat and phone links -->
<svelte:head>
	<title>{m.rb_meta_title({ ref: order.ref })}</title>
	<!-- A customer's own booking: never in a search index. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 pt-8 pb-20 sm:px-8 sm:pt-14">
	<p class="text-sm text-muted-foreground">
		{m.order_placed_on({ date: bothCalendars(order.createdAt) })}
	</p>
	<div class="mt-2 flex flex-wrap items-center gap-3">
		<h1 class="display text-3xl font-bold sm:text-4xl">{m.rb_heading({ ref: order.ref })}</h1>
		<StatusPill label={orderStatusText(order.status)} {tone} />
	</div>
	<p class="mt-5 text-lg">{now}</p>
	{#if order.status === 'pending_payment' && order.holdExpiresAt}
		<p class="mt-2 text-sm text-muted-foreground">
			{m.rb_hold_until({ time: bothClocks(order.holdExpiresAt) })}
		</p>
	{/if}

	{#if result?.done || result?.refused}
		<p
			class={[
				'mt-5 rounded-[var(--radius)] p-4 text-sm',
				result.refused ? 'bg-destructive/10 text-destructive' : 'bg-[#e3f1e6] text-[#1d5b2c]'
			]}
			role={result.refused ? 'alert' : 'status'}
		>
			{result.refused ?? result.done}
		</p>
	{/if}

	<section class="mt-8 rounded-[1.5rem] border border-border bg-card p-6">
		<h2 class="display text-xl font-bold">
			{#if data.listingSlug}
				<a href={path(`/rentals/${data.listingSlug}`)} class="hover:underline">{order.title}</a>
			{:else}
				{m.rb_custom_request()}
			{/if}
		</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			{m.rent_by()}
			<a
				href={path(`/renters/${renter.slug}`)}
				class="font-semibold text-foreground hover:underline">{renterName}</a
			>
		</p>
		<dl class="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
			<div>
				<dt class="text-muted-foreground">{m.rb_when()}</dt>
				<dd class="font-medium">{dates}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">{m.rent_qty()}</dt>
				<dd class="font-medium">
					{order.qty}{#if order.hours}
						· {m.rb_hours({ count: order.hours })}{/if}
				</dd>
			</div>
			{#if order.venue}
				<div class="sm:col-span-2">
					<dt class="text-muted-foreground">{m.quote_venue()}</dt>
					<dd class="font-medium">{order.venue}</dd>
				</div>
			{/if}
			{#if order.message}
				<div class="sm:col-span-2">
					<dt class="text-muted-foreground">{m.rb_your_note()}</dt>
					<dd class="whitespace-pre-line">{order.message}</dd>
				</div>
			{/if}
		</dl>

		{#if order.total != null}
			<dl class="mt-6 flex flex-col gap-2 border-t border-border pt-5 text-sm">
				{#if order.unitPrice != null && order.priceUnit}
					<div class="flex justify-between gap-3 text-muted-foreground">
						<dt>{birr(order.unitPrice)} {unitText(order.priceUnit)}</dt>
						<dd class="tabular-nums">{birr(order.subtotal ?? 0)}</dd>
					</div>
				{:else if order.subtotal != null}
					<div class="flex justify-between gap-3 text-muted-foreground">
						<dt>{m.rb_price()}</dt>
						<dd class="tabular-nums">{birr(order.subtotal)}</dd>
					</div>
				{/if}
				{#if order.deposit > 0}
					<div class="flex justify-between gap-3 text-muted-foreground">
						<dt>{m.rent_deposit()}</dt>
						<dd class="tabular-nums">{birr(order.deposit)}</dd>
					</div>
				{/if}
				<div class="flex items-baseline justify-between gap-3 border-t border-foreground/80 pt-3">
					<dt class="font-semibold">{m.order_total()}</dt>
					<dd class="display text-xl font-bold tabular-nums">{birr(order.total)}</dd>
				</div>
			</dl>
		{/if}
		{#if order.renterNote}
			<div class="mt-5 rounded-[var(--radius)] bg-secondary p-4 text-sm">
				<p class="font-semibold">{m.rb_renter_note({ renter: renterName })}</p>
				<p class="mt-1 whitespace-pre-line text-muted-foreground">{order.renterNote}</p>
			</div>
		{/if}
		{#if order.status === 'quoted' && order.validUntil}
			<p class="mt-3 text-sm text-muted-foreground">
				{m.rb_valid_until({ date: bothCalendarsOnDay(order.validUntil) })}
			</p>
		{/if}
	</section>

	{#if order.status === 'quoted'}
		<form method="POST" action="?/accept" use:enhance={quick} class="mt-6">
			<button
				type="submit"
				disabled={busy}
				class="h-13 w-full rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white disabled:opacity-60 sm:w-auto"
			>
				{#if busy}<LoadingBtn name={m.rent_sending()} />{:else}{m.rb_accept({
						total: birr(order.total ?? 0)
					})}{/if}
			</button>
		</form>
	{/if}

	{#if order.status === 'pending_payment'}
		<section class="mt-10" aria-labelledby="rb-pay">
			<h2 id="rb-pay" class="display text-xl font-bold">{m.rb_pay_heading()}</h2>
			<p class="mt-2 text-sm text-muted-foreground">{m.rb_pay_lede({ renter: renterName })}</p>
			{#if data.accounts.length}
				<form
					method="POST"
					action="?/transfer"
					enctype="multipart/form-data"
					use:transfer.enhance
					class="mt-5 flex flex-col gap-5"
				>
					<TransferFields
						form={transferForm}
						accounts={data.accounts}
						total={order.total ?? 0}
						accountError={firstError($transferErrors.bankAccountId)}
						receiptError={firstError($transferErrors.receipt)}
					/>
					<button
						type="submit"
						disabled={$transferDelayed}
						class="h-12 w-full rounded-full bg-foreground px-6 text-sm font-semibold text-background disabled:opacity-60 sm:w-auto"
					>
						{#if $transferDelayed}<LoadingBtn
								name={m.rent_sending()}
							/>{:else}{m.rb_send_receipt()}{/if}
					</button>
				</form>
			{:else}
				<p class="mt-4 rounded-[var(--radius)] bg-secondary p-4 text-sm">
					{m.market_refused_no_accounts()}
				</p>
			{/if}
		</section>
	{/if}

	{#if data.payments.length}
		<section class="mt-10" aria-labelledby="rb-receipts">
			<h2 id="rb-receipts" class="display text-xl font-bold">{m.rb_receipts()}</h2>
			<ul class="mt-3 flex flex-col divide-y divide-border text-sm">
				{#each data.payments as payment (payment.id)}
					<li class="flex flex-wrap items-baseline justify-between gap-2 py-3">
						<span>{birr(payment.amount)} · {payment.bankName}</span>
						<span class="text-muted-foreground">
							{payment.status === 'accepted'
								? m.rb_receipt_accepted()
								: payment.status === 'rejected'
									? m.rb_receipt_rejected()
									: m.rb_receipt_waiting()}
						</span>
						{#if payment.reviewNote}
							<span class="w-full text-muted-foreground">{payment.reviewNote}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="mt-10 flex flex-wrap gap-3">
		{#if chat}
			<a
				href={chat}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex h-12 items-center rounded-full border border-foreground/30 px-6 text-sm font-semibold"
			>
				{m.rb_chat({ renter: renterName })}
			</a>
		{/if}
		{#if call}
			<a
				href={call}
				class="inline-flex h-12 items-center gap-2 rounded-full border border-foreground/30 px-6 text-sm font-semibold"
			>
				<Phone class="h-4 w-4" aria-hidden="true" />{m.spaces_call()}
			</a>
		{/if}
		{#if canCancel}
			<form method="POST" action="?/cancel" use:enhance={quick} class="ml-auto">
				<button
					type="submit"
					disabled={busy}
					onclick={(event) => {
						if (!confirm(m.rb_cancel_confirm())) event.preventDefault();
					}}
					class="h-12 px-2 text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
				>
					{m.rb_cancel()}
				</button>
			</form>
		{/if}
	</section>

	<p class="mt-10 text-sm text-muted-foreground">{m.rb_keep_link()}</p>
</div>
