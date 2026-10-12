<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import type { AppPath } from '$lib/paths';
	import { quick } from '$lib/quick';
	import { LISTING_STATUS_BADGE } from '$lib/rentalMarket';
	import { listingSchema } from '$lib/schemas/renters';
	import PhotoManager from '$lib/components/dashboard/PhotoManager.svelte';
	import ListingFields from '../ListingFields.svelte';

	let { data } = $props();

	const listing = $derived(data.listing);
	const justAdded = $derived(page.url.searchParams.has('added'));

	// svelte-ignore state_referenced_locally
	const {
		form,
		errors,
		enhance: enhanceForm,
		delayed,
		allErrors
	} = createForm(data.form, listingSchema, { resetForm: false });
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="My rental" title={listing.name} tabTitle="{listing.name} | Amoria renters">
		{#snippet badges()}
			<Statuses status={LISTING_STATUS_BADGE[listing.status]} label={listing.statusLabel} />
		{/snippet}
		<a href={resolve('/renter/listings' as AppPath)} class="text-sm hover:underline"
			>All my rentals</a
		>
		{#snippet actions()}
			{#if listing.status === 'approved'}
				<Button
					href={resolve(`/rentals/${listing.slug}` as AppPath)}
					target="_blank"
					variant="outline"
				>
					<ExternalLink class="size-4" /> View on site
				</Button>
				<form method="POST" action="?/pause" use:enhance={quick}>
					<Button type="submit" variant="outline">Pause</Button>
				</form>
			{:else if listing.status === 'paused'}
				<form method="POST" action="?/resume" use:enhance={quick}>
					<Button type="submit">Put back on the site</Button>
				</form>
			{/if}
			<ConfirmAction
				action="?/remove"
				label="Remove"
				title="Remove this rental?"
				description="It leaves the site and your list for good. Past orders keep its name."
				icon={Trash}
				variant="ghost"
			/>
		{/snippet}
	</PageHeader>

	{#if justAdded}
		<Notice tone="success" title="Saved.">
			Now add photos: rentals with good photos are booked far more often.
		</Notice>
	{/if}
	{#if listing.status === 'pending_review'}
		<Notice tone="info" title="In review.">
			Amoria checks new rentals and changes before they show on the site, usually within a day.
		</Notice>
	{:else if listing.status === 'rejected'}
		<Notice tone="warning" title="Changes needed.">
			{listing.reviewNote ?? 'Amoria asked for changes.'} Fix it and save: it goes back for review.
		</Notice>
	{:else if listing.status === 'paused'}
		<Notice tone="info" title="Paused."
			>Customers cannot see or book it until you put it back.</Notice
		>
	{/if}

	<PhotoManager
		photos={data.photos}
		canRemove={true}
		mainUse="the rental's card on the marketplace and the big picture on its page"
		emptyText="Customers see a plain panel until you add some. Add at least three: the item, it set up, and a close-up."
	/>

	<form method="POST" action="?/save" use:enhanceForm class="grid max-w-3xl gap-4">
		<Errors allErrors={$allErrors} />
		<ListingFields {form} {errors} categories={data.categories} />
		<div>
			<Button type="submit" size="lg">
				{#if $delayed}<LoadingBtn name="Saving" />{:else}Save changes{/if}
			</Button>
		</div>
	</form>
</div>
