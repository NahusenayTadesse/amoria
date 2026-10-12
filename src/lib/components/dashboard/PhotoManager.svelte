<script lang="ts">
	import HiddenField from '@nahu/admin-kit/formComponents/HiddenField.svelte';
	import { enhance } from '$app/forms';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Star from '@lucide/svelte/icons/star';
	import Trash from '@lucide/svelte/icons/trash-2';
	import type { SuperValidated } from 'sveltekit-superforms';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import GalleryUpload from '@nahu/admin-kit/formComponents/GalleryUpload.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { photoEdit, photosAdd } from '$lib/schemas/photos';
	import type { PhotoRow } from '$lib/server/photoGallery';

	/**
	 * A record's photos, from `$lib/server/photoGallery`: the main photo (the first) large, with
	 * its own Replace and Caption, then the whole gallery to add to, reorder, edit and remove from.
	 * Posts to the page's `addPhotos`, `editPhoto`, `deletePhoto` and `movePhoto` actions.
	 */
	type Props = {
		photos: {
			rows: PhotoRow[];
			addForm: SuperValidated<Record<string, unknown>>;
			editForm: SuperValidated<Record<string, unknown>>;
		};
		/** Removing a photo is for super admins (§2.2). */
		canRemove: boolean;
		/** Where the main photo shows, e.g. "the product's card in the shop". */
		mainUse: string;
		/** What the page shows with no photos. */
		emptyText: string;
	};
	let { photos, canRemove, mainUse, emptyText }: Props = $props();

	const rows = $derived(photos.rows);
	const main = $derived(rows[0]);
</script>

<!-- One photo's Replace / Caption dialog; `trigger` names the button. -->
{#snippet editDialog(photo: PhotoRow, trigger: string)}
	<FormDialog
		title={trigger === 'Replace' ? 'Replace or caption this photo' : 'Edit this photo'}
		description="Choose a new file to replace it (compressed in your browser first), or leave it and change only the caption."
		action="?/editPhoto"
		data={photos.editForm}
		schema={photoEdit}
		seed={{ id: photo.id, alt: photo.alt ?? '', altAm: photo.altAm ?? '' }}
		triggerLabel={trigger}
		submitLabel="Save"
		multipart
	>
		{#snippet fields({ form, errors })}
			<InputComp {form} {errors} name="id" type="hidden" />
			<img
				src={publicFileUrl(photo.fileName)}
				alt=""
				class="aspect-[4/3] w-full rounded-md border object-cover"
			/>
			<FileUpload
				{form}
				name="fileName"
				accept="image/*"
				removable={false}
				placeholder="A new photo to replace it (optional)"
			/>
			<InputComp {form} {errors} name="alt" label="What it shows (for screen readers)" />
			<InputComp {form} {errors} name="altAm" label="What it shows, in Amharic" />
		{/snippet}
	</FormDialog>
{/snippet}

{#snippet move(photo: PhotoRow, direction: 'up' | 'down' | 'first', disabled: boolean)}
	<form method="post" action="?/movePhoto" use:enhance>
		<HiddenField name="id" value={photo.id} />
		<HiddenField name="direction" value={direction} />
		<Button
			type="submit"
			size="icon"
			variant="ghost"
			class="size-9"
			{disabled}
			aria-label={direction === 'first'
				? 'Make this the main photo'
				: direction === 'up'
					? 'Move earlier'
					: 'Move later'}
			title={direction === 'first' ? 'Make main' : undefined}
		>
			{#if direction === 'first'}
				<Star class="size-4" />
			{:else if direction === 'up'}
				<ArrowUp class="size-4" />
			{:else}
				<ArrowDown class="size-4" />
			{/if}
		</Button>
	</form>
{/snippet}

<Card.Root>
	<Card.Header class="flex flex-row flex-wrap items-start justify-between gap-3">
		<div>
			<Card.Title>Photos</Card.Title>
			<Card.Description>
				The main photo is {mainUse}; the rest make the gallery, in this order. Add several at once,
				replace any photo, or star one to make it the main photo.
			</Card.Description>
		</div>
		<FormDialog
			title="Add photos"
			description="Pick or drop several at once. Each is compressed in your browser before it uploads, and they go after the photos already here."
			action="?/addPhotos"
			data={photos.addForm}
			schema={photosAdd}
			triggerLabel="Add photos"
			submitLabel="Upload"
			multipart
			resetOnSuccess
		>
			{#snippet fields({ form })}
				<GalleryUpload {form} name="images" />
			{/snippet}
		</FormDialog>
	</Card.Header>
	<Card.Content class="flex flex-col gap-6">
		{#if !main}
			<Notice tone="info" title="No photos yet.">{emptyText}</Notice>
		{:else}
			<!-- The main photo -->
			<div class="grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-start">
				<img
					src={publicFileUrl(main.fileName)}
					alt={main.alt ?? ''}
					class="aspect-[4/3] w-full rounded-lg border object-cover"
				/>
				<div class="flex flex-col gap-3">
					<div>
						<p class="text-sm font-semibold">Main photo</p>
						<p class="text-sm text-muted-foreground">
							{main.alt || 'No caption yet. A short one helps screen readers and search.'}
						</p>
						{#if main.altAm}<p class="text-sm text-muted-foreground" lang="am">{main.altAm}</p>{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						{@render editDialog(main, 'Replace')}
					</div>
				</div>
			</div>

			<!-- The gallery -->
			<div>
				<p class="mb-3 text-sm font-semibold">
					Gallery ({rows.length} photo{rows.length === 1 ? '' : 's'})
				</p>
				<ul class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
					{#each rows as photo, i (photo.id)}
						<li
							class={[
								'flex flex-col overflow-hidden rounded-lg border bg-card',
								i === 0 && 'ring-2 ring-primary'
							]}
						>
							<img
								src={publicFileUrl(photo.fileName)}
								alt={photo.alt ?? ''}
								class="aspect-[4/3] w-full object-cover"
								loading="lazy"
							/>
							<p class="min-h-9 truncate px-3 py-2 text-xs text-muted-foreground">
								{i === 0 ? 'Main. ' : ''}{photo.alt || 'No caption'}
							</p>
							<div class="mt-auto flex flex-wrap items-center gap-0.5 border-t px-1.5 py-1.5">
								{@render move(photo, 'first', i === 0)}
								{@render move(photo, 'up', i === 0)}
								{@render move(photo, 'down', i === rows.length - 1)}
								<div class="ms-auto flex items-center gap-0.5">
									{@render editDialog(photo, 'Edit')}
									{#if canRemove}
										<ConfirmAction
											action="?/deletePhoto"
											label="Remove"
											title="Remove this photo?"
											description={i === 0
												? 'It leaves the gallery, and the next photo becomes the main one.'
												: 'It leaves the gallery.'}
											icon={Trash}
											variant="ghost"
											fields={{ id: photo.id }}
										/>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
