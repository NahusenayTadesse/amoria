<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, bothCalendars, bothClocks } from '$lib/localized';
	import PayPanel from '$lib/components/store/PayPanel.svelte';
	import StatusPill from '$lib/components/store/StatusPill.svelte';

	let { data, form: actionData } = $props();

	const order = $derived(data.order);
	const delivered = $derived(order.fulfilment === 'delivery');

	/** The badge: a submitted receipt reads as its own state, though the order is still unpaid. */
	const status = $derived.by(() => {
		if (order.inReview) return { label: m.order_status_in_review(), tone: 'wait' };
		const labels: Record<string, () => string> = {
			pending_payment: m.order_status_pending_payment,
			paid: m.order_status_paid,
			preparing: m.order_status_preparing,
			ready: m.order_status_ready,
			completed: m.order_status_completed,
			cancelled: m.order_status_cancelled,
			expired: m.order_status_expired,
			paid_unfulfillable: m.order_status_paid_unfulfillable
		};
		const tone = ['paid', 'preparing', 'ready', 'completed'].includes(order.status)
			? 'done'
			: ['cancelled', 'expired'].includes(order.status)
				? 'over'
				: 'wait';
		return { label: (labels[order.status] ?? (() => order.status))(), tone };
	});

	/** What has happened and what happens next, in one sentence (§12.3). */
	const now = $derived.by(() => {
		if (order.inReview) return m.order_now_review();
		switch (order.status) {
			case 'pending_payment':
				return order.holdExpiresAt
					? m.order_now_pending({ time: bothClocks(order.holdExpiresAt) })
					: '';
			case 'paid':
				return delivered
					? m.order_now_paid_delivery({ phone: order.phone })
					: m.order_now_paid({ phone: order.phone });
			case 'preparing':
				return m.order_now_preparing({ phone: order.phone });
			case 'ready':
				return delivered ? m.order_now_ready_delivery({ phone: order.phone }) : m.order_now_ready();
			case 'completed':
				return m.order_now_completed();
			case 'expired':
				return m.order_now_expired();
			case 'cancelled':
				return m.order_now_cancelled();
			case 'paid_unfulfillable':
				return m.order_now_unfulfillable();
			default:
				return '';
		}
	});

	const notice = $derived.by(() => {
		if (order.status !== 'pending_payment' || order.inReview) {
			return data.paymentNotice === 'paid' ? m.order_payment_paid() : null;
		}
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

	const canPay = $derived(order.status === 'pending_payment' && !order.inReview);
</script>

<svelte:head>
	<title>{m.order_meta_title({ ref: order.ref })}</title>
	<!-- A customer's own order: never in a search index. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 pt-8 pb-20 sm:px-8 sm:pt-14">
	<p class="text-sm text-muted-foreground">
		{m.order_placed_on({ date: bothCalendars(order.createdAt) })}
	</p>
	<div class="mt-2 flex flex-wrap items-center gap-3">
		<h1 class="display text-3xl font-bold sm:text-4xl">{m.order_heading({ ref: order.ref })}</h1>
		<StatusPill label={status.label} tone={status.tone as 'done' | 'wait' | 'over'} />
	</div>

	{#if now}
		<p class="mt-5 text-lg">{now}</p>
	{/if}

	<p class="mt-3 text-sm text-muted-foreground">
		{delivered
			? m.order_fulfilment_delivery({
					area: order.deliveryAreaName ?? '',
					address: order.deliveryAddress ?? ''
				})
			: m.order_fulfilment_pickup()}
	</p>

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
		<PayPanel total={order.total} accounts={data.accounts} data={data.transferForm} />
	{/if}

	<section class="mt-10 border-t border-border pt-8">
		<h2 class="display text-xl font-bold">{m.order_items()}</h2>
		<ul class="mt-3 flex flex-col divide-y divide-border">
			{#each data.items as item (item.id)}
				<li class="flex items-baseline justify-between gap-4 py-3 text-sm">
					<span>{item.qty} × {item.name}</span>
					<span class="tabular-nums">{birr(item.lineTotal)}</span>
				</li>
			{/each}
		</ul>
		{#if delivered}
			<div class="flex items-baseline justify-between border-t border-border py-3 text-sm">
				<span>{m.checkout_delivery_fee()}</span>
				<span class="tabular-nums"
					>{order.deliveryFee === 0 ? m.checkout_delivery_free() : birr(order.deliveryFee)}</span
				>
			</div>
		{/if}
		<div class="flex items-baseline justify-between border-t border-foreground/80 pt-3">
			<span class="font-semibold">{m.order_total()}</span>
			<span class="display text-xl font-bold tabular-nums">{birr(order.total)}</span>
		</div>
	</section>

	<p class="mt-10 text-sm text-muted-foreground">{m.order_keep_link()}</p>
	<a
		href={resolve(localizeHref('/shop') as AppPath)}
		class="mt-2 inline-block text-sm font-semibold text-[var(--am-ribbon)] underline underline-offset-4"
	>
		{m.order_back_to_shop()}
	</a>
</div>
