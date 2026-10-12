<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { reveal } from '$lib/actions/reveal';

	/**
	 * Photos as a grid, and a full-screen viewer over it (ported from Joel's project gallery).
	 *
	 * The viewer is a native `<dialog>` opened as a modal, which gives focus trapping, Escape to
	 * close and an inert page behind it for free. Arrow keys and swipes move between photos.
	 * Without scripts each thumbnail is simply a link to the full photo.
	 */
	type Props = { images: { id: number; fileName: string; alt: string }[]; label: string };
	let { images, label }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let index = $state(0);
	const shown = $derived(images[index]);

	function open(event: MouseEvent, i: number) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		index = i;
		dialog?.showModal();
	}

	const step = (by: number) => (index = (index + by + images.length) % images.length);

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') step(1);
		if (event.key === 'ArrowLeft') step(-1);
	}

	/* A horizontal swipe of 50px or more moves; anything less is a tap. */
	let touchX: number | null = null;
	const ontouchstart = (event: TouchEvent) => (touchX = event.touches[0].clientX);
	function ontouchend(event: TouchEvent) {
		if (touchX === null) return;
		const dx = event.changedTouches[0].clientX - touchX;
		touchX = null;
		if (Math.abs(dx) >= 50) step(dx < 0 ? 1 : -1);
	}

	/* A click on the backdrop (the dialog itself, outside its content) closes it. */
	const onclick = (event: MouseEvent) => event.target === dialog && dialog?.close();

	const round =
		'absolute flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20';
</script>

<ul class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
	{#each images as image, i (image.id)}
		<li
			use:reveal
			style="--i: {i % 3}"
			class={i === 0 && images.length > 2 ? 'col-span-2 row-span-2' : ''}
		>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- the photo file itself -->
			<a
				href={publicFileUrl(image.fileName)}
				onclick={(event) => open(event, i)}
				aria-label={m.gallery_open({ n: i + 1, total: images.length })}
				class="group relative block aspect-square h-full overflow-hidden rounded-[1.25rem] bg-secondary"
			>
				<img
					src={publicFileUrl(image.fileName)}
					alt={image.alt}
					loading="lazy"
					decoding="async"
					width="600"
					height="600"
					class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
				/>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</li>
	{/each}
</ul>

<dialog
	bind:this={dialog}
	{onkeydown}
	{onclick}
	{ontouchstart}
	{ontouchend}
	aria-label={label}
	class="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/90 backdrop:backdrop-blur-sm"
>
	{#if shown}
		<div
			class="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 p-4 sm:p-10"
		>
			<img
				src={publicFileUrl(shown.fileName)}
				alt={shown.alt}
				class="pointer-events-auto max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
			/>
			<p class="pointer-events-auto flex gap-2 text-center text-sm text-white/85">
				{#if shown.alt}<span>{shown.alt}</span><span aria-hidden="true">·</span>{/if}
				<span>{m.gallery_counter({ n: index + 1, total: images.length })}</span>
			</p>
		</div>
		<button
			type="button"
			onclick={() => dialog?.close()}
			aria-label={m.gallery_close()}
			class="{round} top-[max(1rem,env(safe-area-inset-top))] right-4"
		>
			<X class="h-6 w-6" aria-hidden="true" />
		</button>
		{#if images.length > 1}
			<button
				type="button"
				onclick={() => step(-1)}
				aria-label={m.gallery_prev()}
				class="{round} top-1/2 left-3 -translate-y-1/2 sm:left-6"
			>
				<ChevronLeft class="h-6 w-6" aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={() => step(1)}
				aria-label={m.gallery_next()}
				class="{round} top-1/2 right-3 -translate-y-1/2 sm:right-6"
			>
				<ChevronRight class="h-6 w-6" aria-hidden="true" />
			</button>
		{/if}
	{/if}
</dialog>
