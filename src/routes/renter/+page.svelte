<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Circle from '@lucide/svelte/icons/circle';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import type { AppPath } from '$lib/paths';
	import { ethDay } from '$lib/stock';
	import { RENTER_ORDER_BADGE, RENTER_ORDER_LABELS } from '$lib/rentalMarket';
	import { renterDocumentsSchema } from '$lib/schemas/renters';

	let { data } = $props();

	const renter = $derived(data.renter);
	const c = $derived(data.counts);
	const path = (to: string) => resolve(to as AppPath);

	const stats = $derived<Stat[]>([
		{
			key: 'requests',
			label: 'Quote requests to answer',
			value: c.requests,
			format: 'count',
			group: 'now',
			tone: c.requests ? 'warning' : 'neutral'
		},
		{
			key: 'receipts',
			label: 'Payment receipts to check',
			value: c.receipts,
			format: 'count',
			group: 'now',
			tone: c.receipts ? 'warning' : 'neutral'
		},
		{
			key: 'awaiting',
			label: 'Waiting for the customer',
			value: c.awaiting,
			format: 'count',
			group: 'now',
			hint: 'Quotes sent and bookings not paid yet'
		},
		{
			key: 'live',
			label: 'Rentals on the site',
			value: c.live,
			format: 'count',
			group: 'now',
			hint: c.inReview ? `${c.inReview} more in review` : undefined,
			tone: 'positive'
		},
		{
			key: 'completed',
			label: 'Completed bookings',
			value: c.completed,
			format: 'count',
			group: 'now'
		}
	]);

	const steps = $derived([
		{
			done: data.setup.profile,
			label: 'Add your logo and a few words about your business',
			href: '/renter/profile'
		},
		{
			done: data.setup.accounts,
			label: 'Add the bank account customers pay into',
			href: '/renter/bank-accounts'
		},
		{
			done: data.setup.listing,
			label: 'List your first rental, with photos',
			href: '/renter/listings/new'
		}
	]);

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.documentsForm, renterDocumentsSchema, {
		resetForm: false
	});
</script>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Welcome, {renter.businessName}"
		tabTitle="Overview | Amoria renters"
		description="What needs you now, and how your rentals are doing on Amoria."
	/>

	{#if renter.status === 'pending'}
		<Notice tone="info" title="Amoria is checking your business.">
			We look at your TIN and trade licence, usually within two working days. Meanwhile, set up your
			shop profile and bank accounts so you are ready to list as soon as you are approved.
		</Notice>
	{:else if renter.status === 'rejected'}
		<Notice tone="danger" title="Your papers need another look.">
			{renter.reviewNote ?? 'Amoria could not approve your business yet.'} Send them again below.
		</Notice>
	{:else if renter.status === 'suspended'}
		<Notice tone="danger" title="Your account is suspended.">
			{renter.reviewNote ?? ''} Your page and rentals are hidden from customers. Contact Amoria to sort
			it out.
		</Notice>
	{:else if renter.autoPublish}
		<Notice tone="success" title="Trusted renter.">
			Amoria lets you post without review: new rentals and changes go live at once.
		</Notice>
	{/if}

	{#if renter.status === 'rejected'}
		<form
			method="POST"
			action="?/resubmit"
			enctype="multipart/form-data"
			use:enhance
			class="max-w-2xl"
		>
			<FormCard
				title="Send your papers again"
				description="Your TIN and a clear photo or PDF of your current trade licence."
			>
				<div class="grid gap-4">
					<InputComp {form} {errors} name="tinNumber" label="TIN (10 digits)" />
					<FileUpload
						{form}
						name="tradeLicence"
						accept="image/*,application/pdf"
						placeholder="Trade licence: photo or PDF, up to 10 MB"
					/>
					<div>
						<Button type="submit">
							{#if $delayed}<LoadingBtn name="Sending" />{:else}Send for review{/if}
						</Button>
					</div>
				</div>
			</FormCard>
		</form>
	{/if}

	<div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-5">
		{#each stats as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</div>

	<div class="flex flex-wrap gap-2">
		<Button href={path('/renter/requests')}>Answer quote requests</Button>
		<Button href={path('/renter/orders?status=payment_review')} variant="outline">
			Check receipts
		</Button>
		<Button href={path('/renter/listings/new')} variant="outline">List a rental</Button>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		{#if steps.some((step) => !step.done)}
			<Card.Root>
				<Card.Header>
					<Card.Title>Get ready for your first booking</Card.Title>
					<Card.Description
						>Three steps; customers see your page once you are approved.</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<ol class="flex flex-col gap-3">
						{#each steps as step (step.href)}
							<li class="flex items-start gap-3">
								{#if step.done}
									<CircleCheck class="mt-0.5 size-5 shrink-0 text-green-600" />
									<span class="text-muted-foreground line-through">{step.label}</span>
								{:else}
									<Circle class="mt-0.5 size-5 shrink-0 text-muted-foreground" />
									<a href={path(step.href)} class="font-medium hover:underline">{step.label}</a>
								{/if}
							</li>
						{/each}
					</ol>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header>
				<Card.Title>Coming up</Card.Title>
				<Card.Description>Paid bookings that have not ended yet.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.upcoming.length}
					<ul class="divide-y text-sm">
						{#each data.upcoming as order (order.id)}
							<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
								<a href={path(`/renter/orders/${order.id}`)} class="font-medium hover:underline">
									{order.title}
								</a>
								<span class="text-muted-foreground">
									× {order.qty}, {order.contactName}, {ethDay(order.startDate)}{order.endDate !==
									order.startDate
										? ` to ${ethDay(order.endDate)}`
										: ''}
								</span>
								<span class="ms-auto">
									<Statuses
										status={RENTER_ORDER_BADGE[order.status]}
										label={RENTER_ORDER_LABELS[order.status]}
									/>
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-muted-foreground">Nothing booked ahead yet.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
