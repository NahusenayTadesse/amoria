<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import YouTubeEmbed from '@nahu/admin-kit/components/YouTubeEmbed.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import type { AppPath } from '$lib/paths';
	import { quick } from '$lib/quick';
	import {
		LISTING_STATUS_BADGE,
		LISTING_STATUS_LABELS,
		PRICE_UNIT_LABELS,
		RENTER_STATUS_LABELS
	} from '$lib/rentalMarket';
	import { reviewNoteSchema } from '$lib/schemas/renters';

	let { data } = $props();

	const l = $derived(data.listing);
	const list = (value: unknown) => (Array.isArray(value) ? (value as string[]) : []);
	const canApprove = $derived(
		data.renterStatus === 'approved' && ['pending_review', 'rejected', 'paused'].includes(l.status)
	);
</script>

<div class="flex max-w-5xl flex-col gap-4">
	<PageHeader eyebrow="Renter listing" title={l.name} tabTitle="Review {l.name} | Amoria">
		{#snippet badges()}
			<Statuses status={LISTING_STATUS_BADGE[l.status]} label={LISTING_STATUS_LABELS[l.status]} />
		{/snippet}
		<p class="text-sm text-muted-foreground">
			By
			<a
				href={resolve(`/dashboard/renters/${data.renterId}` as AppPath)}
				class="font-medium text-foreground hover:underline"
			>
				{data.renterName}</a
			>, changed {ethiopianDateTime(l.updatedAt)}
			<a
				href={resolve('/dashboard/renters/listings?status=pending_review' as AppPath)}
				class="ml-2 hover:underline">Review queue</a
			>
		</p>
		{#snippet actions()}
			{#if canApprove}
				<form method="POST" action="?/approve" use:enhance={quick}>
					<Button type="submit"><Check class="size-4" /> Approve</Button>
				</form>
			{/if}
			{#if l.status !== 'rejected'}
				<FormDialog
					title={l.status === 'approved' ? 'Take this rental down' : 'Send it back'}
					description="It leaves the site (if live) and the renter sees your note, fixes it and sends it again."
					action="?/reject"
					data={data.noteForm}
					schema={reviewNoteSchema}
					triggerLabel={l.status === 'approved' ? 'Take down' : 'Needs changes'}
					submitLabel="Send back"
				>
					{#snippet fields({ form, errors })}
						<InputComp {form} {errors} name="note" type="textarea" rows={3} label="What to fix" />
					{/snippet}
				</FormDialog>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.renterStatus !== 'approved'}
		<Notice tone="warning" title="The renter is not approved.">
			They are “{RENTER_STATUS_LABELS[data.renterStatus]}”: approve the renter before any of their
			rentals can go live.
		</Notice>
	{/if}
	{#if l.reviewNote}
		<Notice tone="info" title="Last note"
			>{l.reviewNote}{data.reviewerName ? ` (${data.reviewerName})` : ''}</Notice
		>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Photos ({data.photos.length})</Card.Title>
			<Card.Description
				>Check they show the real item and nothing that should not be public.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if data.photos.length}
				<ul class="grid grid-cols-2 gap-3 md:grid-cols-4">
					{#each data.photos as photo, i (photo.id)}
						<li>
							<img
								src={publicFileUrl(photo.fileName)}
								alt={photo.alt ?? ''}
								class={[
									'aspect-[4/3] w-full rounded-md border object-cover',
									i === 0 && 'ring-2 ring-primary'
								]}
								loading="lazy"
							/>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">No photos.</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header><Card.Title>Details</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-2 text-sm">
				<p><span class="text-muted-foreground">Category:</span> {data.categoryName}</p>
				<p>
					<span class="text-muted-foreground">Price:</span>
					{l.pricing === 'quote'
						? `Quote only${l.price ? `, from ${formatETB(l.price, false)}` : ''}`
						: `${formatETB(l.price, false)} ${PRICE_UNIT_LABELS[l.priceUnit]}`}
					{#if l.deposit}, deposit {formatETB(l.deposit, false)} each{/if}
				</p>
				<p><span class="text-muted-foreground">How many:</span> {l.quantity}</p>
				{#if l.capacity}<p><span class="text-muted-foreground">Guests:</span> {l.capacity}</p>{/if}
				<p>
					<span class="text-muted-foreground">Delivery:</span>
					{l.deliveryAvailable ? 'yes' : 'no'};
					<span class="text-muted-foreground">set-up included:</span>
					{l.setupIncluded ? 'yes' : 'no'}
				</p>
				{#if l.nameAm}<p lang="am">
						<span class="text-muted-foreground">Amharic name:</span>
						{l.nameAm}
					</p>{/if}
				{#if l.summary}<p class="font-medium">{l.summary}</p>{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>What comes with it</Card.Title></Card.Header>
			<Card.Content>
				{#if list(l.features).length}
					<ul class="list-disc ps-5 text-sm">
						{#each list(l.features) as feature, i (i)}<li>{feature}</li>{/each}
					</ul>
				{:else}
					<p class="text-sm text-muted-foreground">Nothing listed.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	{#if l.description || l.descriptionAm}
		<Card.Root>
			<Card.Header><Card.Title>Description</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-3 text-sm whitespace-pre-line">
				{#if l.description}<p>{l.description}</p>{/if}
				{#if l.descriptionAm}<p lang="am" class="border-t pt-3">{l.descriptionAm}</p>{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if l.youtubeUrl}
		<div class="max-w-2xl">
			<YouTubeEmbed url={l.youtubeUrl} title={l.name} showWatchLink />
		</div>
	{/if}
</div>
