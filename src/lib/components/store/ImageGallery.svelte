<script lang="ts">
	import { publicFileUrl } from '@nahu/admin-kit/files';

	type Props = {
		images: { fileName: string; alt: string }[];
		/** Shown when there is no photo yet. */
		fallback?: import('svelte').Snippet;
	};

	let { images, fallback }: Props = $props();

	let index = $state(0);
	const current = $derived(images[Math.min(index, images.length - 1)]);
</script>

<!-- One large photo and a row of thumbnails to swap it (§12.2). No photos: the fallback. -->
<div class="flex flex-col gap-3">
	<div class="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-secondary">
		{#if current}
			{#key current.fileName}
				<img
					src={publicFileUrl(current.fileName)}
					alt={current.alt}
					width="960"
					height="720"
					fetchpriority="high"
					class="swap absolute inset-0 h-full w-full object-cover"
				/>
			{/key}
		{:else}
			{@render fallback?.()}
		{/if}
	</div>

	{#if images.length > 1}
		<ul class="flex gap-2 overflow-x-auto pb-1">
			{#each images as image, i (image.fileName)}
				<li class="shrink-0">
					<button
						type="button"
						onclick={() => (index = i)}
						aria-label={image.alt}
						aria-current={i === index ? 'true' : undefined}
						class={[
							'block h-16 w-20 overflow-hidden rounded-xl border-2 transition-all duration-300',
							i === index
								? 'border-[var(--am-ribbon)]'
								: 'border-transparent opacity-70 hover:opacity-100'
						]}
					>
						<img
							src={publicFileUrl(image.fileName)}
							alt=""
							loading="lazy"
							decoding="async"
							width="80"
							height="64"
							class="h-full w-full object-cover"
						/>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.swap {
		animation: swap 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes swap {
		from {
			opacity: 0;
			transform: scale(1.04);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.swap {
			animation: none;
		}
	}
</style>
