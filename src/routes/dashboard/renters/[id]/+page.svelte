<script lang="ts">
	import HiddenField from '@nahu/admin-kit/formComponents/HiddenField.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { fileUrl, publicFileUrl } from '@nahu/admin-kit/files';
	import { formatETB } from '@nahu/admin-kit/global';
	import { ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { localPhone } from '@nahu/admin-kit/phone';
	import type { AppPath } from '$lib/paths';
	import { quick } from '$lib/quick';
	import {
		LISTING_STATUS_BADGE,
		LISTING_STATUS_LABELS,
		PRICE_UNIT_LABELS,
		RENTER_ORDER_LABELS,
		RENTER_STATUS_BADGE,
		RENTER_STATUS_LABELS,
		type RenterOrderStatus
	} from '$lib/rentalMarket';
	import { reviewNoteSchema } from '$lib/schemas/renters';

	let { data } = $props();

	const r = $derived(data.renter);
	const licenceIsPdf = $derived(r.tradeLicenceFile.toLowerCase().endsWith('.pdf'));
	const phone = (value: string | null) => (value ? (localPhone(value) ?? value) : null);

	const facts = $derived(
		[
			['Owner', `${data.owner.name}, ${data.owner.email}`],
			['Phone', phone(r.phone)],
			['WhatsApp', phone(r.whatsapp)],
			['Telegram', r.telegram ? `@${r.telegram}` : null],
			['Where', r.area],
			['Works in', r.serviceAreas],
			['Since', r.foundedYear ? String(r.foundedYear) : null],
			[
				'Offers',
				[r.offersDelivery && 'delivery', r.offersSetup && 'set-up'].filter(Boolean).join(', ') ||
					null
			],
			['Signed up', ethiopianDateTime(r.createdAt)]
		].filter(([, value]) => value)
	);
</script>

{#snippet noteDialog(action: string, title: string, trigger: string, description: string)}
	<FormDialog
		{title}
		{description}
		{action}
		data={data.noteForm}
		schema={reviewNoteSchema}
		triggerLabel={trigger}
		submitLabel={trigger}
	>
		{#snippet fields({ form, errors })}
			<InputComp
				{form}
				{errors}
				name="note"
				type="textarea"
				rows={3}
				label="Reason, as the renter will read it"
			/>
		{/snippet}
	</FormDialog>
{/snippet}

<div class="flex max-w-5xl flex-col gap-4">
	<PageHeader eyebrow="Renter" title={r.businessName} tabTitle="{r.businessName} | Amoria">
		{#snippet badges()}
			<Statuses status={RENTER_STATUS_BADGE[r.status]} label={RENTER_STATUS_LABELS[r.status]} />
			{#if r.autoPublish}<Statuses status="sent" label="Posts without review" />{/if}
			{#if r.isFeatured}<Statuses status="success" label="Featured" />{/if}
		{/snippet}
		<a href={resolve('/dashboard/renters' as AppPath)} class="text-sm hover:underline"
			>All renters</a
		>
		{#snippet actions()}
			{#if r.status === 'pending' || r.status === 'rejected'}
				<form method="POST" action="?/approve" use:enhance={quick}>
					<Button type="submit">Approve</Button>
				</form>
			{/if}
			{#if r.status === 'pending'}
				{@render noteDialog(
					'?/reject',
					'Turn this renter down',
					'Turn down',
					'They can fix it and send their papers again.'
				)}
			{/if}
			{#if r.status === 'approved'}
				<Button href={resolve(`/renters/${r.slug}` as AppPath)} target="_blank" variant="outline">
					<ExternalLink class="size-4" /> Their page
				</Button>
				{@render noteDialog(
					'?/suspend',
					'Suspend this renter',
					'Suspend',
					'Their page and rentals leave the site at once and they are signed out. Open orders stay for them to finish.'
				)}
			{/if}
			{#if r.status === 'suspended'}
				<form method="POST" action="?/reinstate" use:enhance={quick}>
					<Button type="submit">Reinstate</Button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	{#if r.reviewNote}
		<Notice tone="warning" title="Last decision's reason">
			{r.reviewNote}{data.reviewerName ? ` (${data.reviewerName})` : ''}
		</Notice>
	{/if}

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Papers to check</Card.Title>
				<Card.Description
					>Private. Check the TIN against the licence and the business name.</Card.Description
				>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<p>
					<span class="text-muted-foreground">TIN:</span>
					<span class="font-mono font-semibold">{r.tinNumber}</span>
				</p>
				<a
					href={resolve(fileUrl(r.tradeLicenceFile) as AppPath)}
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-1 text-primary hover:underline"
				>
					<FileText class="size-4" /> Open the trade licence
				</a>
				{#if !licenceIsPdf}
					<img
						src={fileUrl(r.tradeLicenceFile)}
						alt="Trade licence of {r.businessName}"
						class="max-h-96 w-full rounded-md border object-contain"
					/>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>The business</Card.Title></Card.Header>
			<Card.Content class="flex flex-col gap-3">
				{#if r.logoFile || r.coverFile}
					<div class="flex items-center gap-3">
						{#if r.logoFile}
							<img
								src={publicFileUrl(r.logoFile)}
								alt=""
								class="size-14 rounded-full border object-cover"
							/>
						{/if}
						{#if r.coverFile}
							<img
								src={publicFileUrl(r.coverFile)}
								alt=""
								class="h-14 flex-1 rounded-md border object-cover"
							/>
						{/if}
					</div>
				{/if}
				{#if r.tagline}<p class="font-medium">{r.tagline}</p>{/if}
				<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
					{#each facts as [label, value] (label)}
						<div>
							<dt class="text-muted-foreground">{label}</dt>
							<dd>{value}</dd>
						</div>
					{/each}
				</dl>
				{#if r.about}<p class="border-t pt-3 text-sm whitespace-pre-line">{r.about}</p>{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Trust</Card.Title>
			<Card.Description>
				Posting without review lets their new rentals and changes go live at once. Give it to
				renters whose listings have been good for a while; you can still take any rental down.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-wrap gap-2">
			<form method="POST" action="?/trust" use:enhance={quick}>
				<HiddenField name="on" value={r.autoPublish ? '0' : '1'} />
				<Button type="submit" variant={r.autoPublish ? 'outline' : 'default'}>
					{r.autoPublish ? 'Review their posts again' : 'Allow posting without review'}
				</Button>
			</form>
			<form method="POST" action="?/feature" use:enhance={quick}>
				<HiddenField name="on" value={r.isFeatured ? '0' : '1'} />
				<Button type="submit" variant="outline">
					{r.isFeatured ? 'Stop featuring' : 'Feature on the marketplace'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header><Card.Title>Bank accounts</Card.Title></Card.Header>
			<Card.Content>
				{#if data.accounts.length}
					<ul class="divide-y text-sm">
						{#each data.accounts as a (a.id)}
							<li class="py-2">
								<span class="font-medium">{a.bankName}</span>, {a.accountName}, {a.accountNumber}
								{#if !a.status}<span class="text-muted-foreground">(hidden)</span>{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-muted-foreground">None yet: they cannot take bookings.</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Orders</Card.Title></Card.Header>
			<Card.Content>
				{#if Object.keys(data.orders).length}
					<ul class="grid grid-cols-2 gap-2 text-sm">
						{#each Object.entries(data.orders) as [status, n] (status)}
							<li>
								{RENTER_ORDER_LABELS[status as RenterOrderStatus]}:
								<span class="font-semibold">{n}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-muted-foreground">No orders yet.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header><Card.Title>Rentals</Card.Title></Card.Header>
		<Card.Content>
			{#if data.listings.length}
				<ul class="divide-y text-sm">
					{#each data.listings as l (l.id)}
						<li class="flex flex-wrap items-center gap-3 py-2.5">
							<a
								href={resolve(`/dashboard/renters/listings/${l.id}` as AppPath)}
								class="font-medium hover:underline"
							>
								{l.name}
							</a>
							<span class="text-muted-foreground">
								{l.categoryName},
								{l.pricing === 'quote'
									? 'quote only'
									: `${formatETB(l.price, false)} ${PRICE_UNIT_LABELS[l.priceUnit]}`}
							</span>
							<span class="ms-auto">
								<Statuses
									status={LISTING_STATUS_BADGE[l.status]}
									label={LISTING_STATUS_LABELS[l.status]}
								/>
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">Nothing listed yet.</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
