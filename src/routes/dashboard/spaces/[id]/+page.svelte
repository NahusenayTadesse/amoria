<script lang="ts">
	import { resolve } from '$app/paths';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import YouTubeEmbed from '@nahu/admin-kit/components/YouTubeEmbed.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import type { AppPath } from '$lib/paths';
	import PhotoManager from '$lib/components/dashboard/PhotoManager.svelte';

	let { data } = $props();

	const s = $derived(data.space);
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Rental space" title={s.name} tabTitle="{s.name} | Amoria">
		{#snippet badges()}
			<Statuses
				status={s.isActive ? 'active' : 'inactive'}
				label={s.isActive ? 'On offer' : 'Not on offer'}
			/>
		{/snippet}
		<p class="text-muted-foreground">
			{s.price != null
				? `From ${formatETB(s.price)}${s.priceUnit ? ` ${s.priceUnit}` : ''}`
				: 'Price on request'}{s.capacity ? `, up to ${s.capacity} guests` : ''}{s.sizeText
				? `, ${s.sizeText}`
				: ''}
			{#if s.nameAm}<span lang="am">({s.nameAm})</span>{/if}
			<a href={resolve('/dashboard/spaces')} class="ml-2 text-sm hover:underline">All spaces</a>
		</p>
		{#snippet actions()}
			{#if s.isActive}
				<Button href={resolve(`/spaces/${s.slug}` as AppPath)} target="_blank" variant="outline">
					<ExternalLink class="size-4" /> View on site
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<PhotoManager
		photos={data.photos}
		canRemove={data.isSuperAdmin}
		mainUse="the space's card on /spaces and the big picture at the top of its page"
		emptyText="The space's page shows a plain panel until you add some."
	/>

	<Card.Root>
		<Card.Header>
			<Card.Title>Video</Card.Title>
			<Card.Description>
				Paste a YouTube link in the space's details on the list page (a watch, youtu.be or Shorts
				link). Guests see it as below; nothing loads from YouTube until they press play.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if s.youtubeUrl}
				<div class="max-w-2xl">
					<YouTubeEmbed url={s.youtubeUrl} title={s.name} showWatchLink />
				</div>
			{:else}
				<Notice tone="info" title="No video yet.">
					The space's page shows only its photos until a video is added.
				</Notice>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
