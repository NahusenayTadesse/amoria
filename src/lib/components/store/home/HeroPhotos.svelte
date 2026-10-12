<!--
	Photos drifting around the hero's balloon arch. Decorative: the gallery further down shows the
	same kind of rooms with captions, so these are hidden from screen readers.
	Demo stock photos for now (scripts/demo-images.sh) — replace with Amoria's own before launch.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { responsive } from '$lib/img';

	/** The big arch-topped photo the others gather around. */
	const main = responsive('/images/demo/gallery-ceremony-chairs.webp', 480, 900);

	/** Where each smaller photo sits around it, and how it tilts, drifts and how long it takes. */
	const photos = [
		{
			src: '/images/demo/gallery-gold-letters-480.webp',
			w: 480,
			h: 720,
			place: 'top-[0%] left-[-3%] w-[24%] sm:left-[-4%]',
			tilt: -9,
			delay: 0.4,
			dur: 8
		},
		{
			src: '/images/demo/hero-bouquet.webp',
			w: 480,
			h: 600,
			place: 'bottom-[0%] left-[-4%] w-[28%] sm:left-[-5%]',
			tilt: -6,
			delay: 0,
			dur: 7
		},
		{
			src: '/images/demo/hero-aisle.webp',
			w: 480,
			h: 600,
			place: 'top-[-2%] right-[-3%] w-[27%] sm:right-[-6%]',
			tilt: 7,
			delay: 1.6,
			dur: 9
		},
		{
			src: '/images/demo/gallery-centerpiece-480.webp',
			w: 480,
			h: 768,
			place: 'top-[42%] right-[-7%] w-[21%] sm:right-[-9%]',
			tilt: 5,
			delay: 2.4,
			dur: 6.5
		},
		{
			src: '/images/demo/hero-cake.webp',
			w: 480,
			h: 600,
			place: 'right-[-3%] bottom-[0%] w-[27%] sm:right-[-6%]',
			tilt: -5,
			delay: 3.1,
			dur: 7.5
		}
	];
</script>

<div class="main absolute top-[27%] left-[30%] h-[56%] w-[40%]" aria-hidden="true">
	<img
		src={main.src}
		srcset={main.srcset}
		sizes="(min-width: 1024px) 260px, 40vw"
		alt=""
		width="900"
		height="1350"
		fetchpriority="high"
		decoding="async"
		class="h-full w-full rounded-t-full rounded-b-[1.5rem] object-cover"
	/>
</div>

{#each photos as photo, index (photo.src)}
	<div
		class="photo absolute {photo.place}"
		style="--tilt: {photo.tilt}deg; --delay: {photo.delay}s; --dur: {photo.dur}s; --i: {index + 3}"
		aria-hidden="true"
	>
		<img
			src={asset(photo.src)}
			alt=""
			width={photo.w}
			height={photo.h}
			loading="lazy"
			decoding="async"
			class="w-full rounded-[0.9rem] object-cover"
			style:aspect-ratio="{photo.w} / {photo.h}"
		/>
	</div>
{/each}

<style>
	.main {
		z-index: 1;
		padding: 0.5rem;
		border-radius: 999px 999px 2rem 2rem;
		background: var(--card);
		box-shadow: 0 40px 80px -30px rgb(0 0 0 / 0.5);
		animation: arrive 1s cubic-bezier(0.2, 0.75, 0.2, 1) 0.2s both;
	}
	.main img {
		animation: slow-zoom 14s ease-in-out infinite alternate;
	}
	@keyframes slow-zoom {
		to {
			transform: scale(1.07);
		}
	}
	.main {
		overflow: hidden;
	}
	.photo {
		transition:
			scale 0.4s ease,
			box-shadow 0.4s ease;
	}
	.photo:hover {
		scale: 1.06;
	}
	.photo {
		z-index: 2;
		padding: 0.4rem;
		border-radius: 1.2rem;
		background: var(--card);
		box-shadow: 0 22px 44px -22px rgb(0 0 0 / 0.45);
		rotate: var(--tilt);
		animation:
			arrive 0.9s cubic-bezier(0.2, 0.75, 0.2, 1) calc(var(--i) * 0.12s + 0.1s) both,
			drift var(--dur) ease-in-out var(--delay) infinite;
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(18px);
		}
	}
	@keyframes drift {
		50% {
			translate: 0 -12px;
			rotate: calc(var(--tilt) * 0.6);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.main,
		.photo {
			animation: none;
		}
	}
</style>
