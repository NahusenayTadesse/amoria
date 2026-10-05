<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import Mail from '@lucide/svelte/icons/mail';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Phone from '@lucide/svelte/icons/phone';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { QUOTE_REQUEST_STATUSES } from '$lib/constants';
	import { CHANNEL_LABELS, QUOTE_REQUEST_LABELS } from '$lib/quoteRequestStatus';

	let { data, form } = $props();

	const request = $derived(data.request);
	const digits = $derived(request.contactPhone.replace(/\D/g, ''));

	const details = $derived(
		[
			['Event', data.eventName],
			['Date', request.eventDate],
			['Where', request.venue],
			['Guests', request.guestCount],
			['Colours or mood', request.theme],
			['Budget', request.budget === null ? null : formatETB(request.budget)],
			['Package', data.packageName],
			['Prefers', CHANNEL_LABELS[request.preferredChannel]]
		].filter(([, value]) => value !== null && value !== undefined && value !== '')
	);
</script>

<svelte:head>
	<title>Quote request from {request.contactName} | Amoria</title>
</svelte:head>

<div class="flex max-w-3xl flex-col gap-4">
	<a
		href={resolve('/dashboard/quote-requests' as AppPath)}
		class="text-sm text-muted-foreground hover:text-foreground">← All quote requests</a
	>

	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-semibold">{request.contactName}</h1>
		<Statuses status={request.status} label={QUOTE_REQUEST_LABELS[request.status]} />
	</div>
	<p class="text-sm text-muted-foreground">
		Received {ethiopianDateTime(request.createdAt)}
		{#if data.assigneeName}· with {data.assigneeName}{/if}
	</p>

	{#if form?.error}<p class="text-sm text-destructive" role="alert">{form.error}</p>{/if}
	{#if form?.done}<p class="text-sm text-green-700" role="status">{form.done}</p>{/if}

	<Card.Root>
		<Card.Header><Card.Title>Reach the customer</Card.Title></Card.Header>
		<Card.Content class="flex flex-wrap gap-2">
			<Button href="tel:{request.contactPhone}" variant="outline" size="sm"
				><Phone class="mr-1.5 h-4 w-4" />{request.contactPhone}</Button
			>
			<Button
				href="https://wa.me/{digits}"
				target="_blank"
				rel="noopener noreferrer"
				variant="outline"
				size="sm"><MessageCircle class="mr-1.5 h-4 w-4" />WhatsApp</Button
			>
			{#if request.contactEmail}
				<Button href="mailto:{request.contactEmail}" variant="outline" size="sm"
					><Mail class="mr-1.5 h-4 w-4" />{request.contactEmail}</Button
				>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header><Card.Title>The event</Card.Title></Card.Header>
		<Card.Content>
			{#if details.length}
				<dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
					{#each details as [label, value] (label)}
						<div>
							<dt class="text-sm text-muted-foreground">{label}</dt>
							<dd class="font-medium">{value}</dd>
						</div>
					{/each}
				</dl>
			{:else}
				<p class="text-muted-foreground">They gave only their contact details.</p>
			{/if}
			{#if request.message}
				<p class="mt-4 border-t pt-4 whitespace-pre-line">{request.message}</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header><Card.Title>Where it stands</Card.Title></Card.Header>
		<Card.Content>
			<form method="POST" action="?/status" use:enhance class="flex flex-wrap items-center gap-2">
				{#each QUOTE_REQUEST_STATUSES as status (status)}
					<Button
						type="submit"
						name="to"
						value={status}
						variant={request.status === status ? 'default' : 'outline'}
						size="sm">{QUOTE_REQUEST_LABELS[status]}</Button
					>
				{/each}
				<label class="ml-2 flex items-center gap-2 text-sm">
					<input type="checkbox" name="assign" value="me" checked={!request.assignedTo} />
					Assign to me
				</label>
			</form>
		</Card.Content>
	</Card.Root>
</div>
