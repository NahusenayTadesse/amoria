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
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { CHANNEL_LABELS, MESSAGE_LABELS, MESSAGE_STATUSES } from '$lib/quoteRequestStatus';

	let { data, form } = $props();

	const note = $derived(data.message);
	const digits = $derived(note.contactPhone.replace(/\D/g, ''));
	const label = $derived(MESSAGE_LABELS[note.status as keyof typeof MESSAGE_LABELS] ?? note.status);
</script>

<svelte:head>
	<title>Message from {note.contactName} | Amoria</title>
</svelte:head>

<div class="flex max-w-3xl flex-col gap-4">
	<a
		href={resolve('/dashboard/messages' as AppPath)}
		class="text-sm text-muted-foreground hover:text-foreground">← All messages</a
	>

	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-semibold">{note.contactName}</h1>
		<Statuses status={note.status} {label} />
	</div>
	<p class="text-sm text-muted-foreground">
		Received {ethiopianDateTime(note.createdAt)}
		· prefers {CHANNEL_LABELS[note.preferredChannel] ?? note.preferredChannel}
		{#if data.assigneeName}· replied by {data.assigneeName}{/if}
	</p>

	{#if form?.error}<p class="text-sm text-destructive" role="alert">{form.error}</p>{/if}
	{#if form?.done}<p class="text-sm text-green-700" role="status">{form.done}</p>{/if}

	<Card.Root>
		<Card.Header><Card.Title>Their message</Card.Title></Card.Header>
		<Card.Content>
			<p class="whitespace-pre-line">{note.message}</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header><Card.Title>Reply</Card.Title></Card.Header>
		<Card.Content class="flex flex-col gap-4">
			<div class="flex flex-wrap gap-2">
				<Button href="tel:{note.contactPhone}" variant="outline" size="sm"
					><Phone class="mr-1.5 h-4 w-4" />{note.contactPhone}</Button
				>
				<Button
					href="https://wa.me/{digits}"
					target="_blank"
					rel="noopener noreferrer"
					variant="outline"
					size="sm"><MessageCircle class="mr-1.5 h-4 w-4" />WhatsApp</Button
				>
				{#if note.contactEmail}
					<Button href="mailto:{note.contactEmail}" variant="outline" size="sm"
						><Mail class="mr-1.5 h-4 w-4" />{note.contactEmail}</Button
					>
				{/if}
			</div>
			<form method="POST" action="?/status" use:enhance class="flex flex-wrap gap-2">
				{#each MESSAGE_STATUSES as status (status)}
					<Button
						type="submit"
						name="to"
						value={status}
						variant={note.status === status ? 'default' : 'outline'}
						size="sm">{MESSAGE_LABELS[status]}</Button
					>
				{/each}
			</form>
		</Card.Content>
	</Card.Root>
</div>
