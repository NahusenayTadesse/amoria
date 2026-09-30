<!--
	Photos drifting around the hero's balloon arch. Decorative: the gallery further down shows the
	same kind of rooms with captions, so these are hidden from screen readers.
	Demo stock photos for now (scripts/demo-images.sh) — replace with Amoria's own before launch.
-->
<script lang="ts">
	import { asset } from '$app/paths';

	/** Where each photo sits around the arch, and how it tilts and drifts. */
	const photos = [
		{
			name: 'hero-bouquet',
			place: 'top-[8%] left-0 w-[27%] sm:left-[-6%] sm:w-[30%]',
			tilt: -8,
			delay: 0
		},
		{
			name: 'hero-aisle',
			place: 'top-[2%] right-0 w-[25%] sm:right-[-5%] sm:w-[27%]',
			tilt: 7,
			delay: 1.6
		},
		{
			name: 'hero-cake',
			place: 'right-0 bottom-[4%] w-[27%] sm:right-[-2%] sm:w-[29%]',
			tilt: -5,
			delay: 3.1
		}
	];
</script>

{#each photos as photo, index (photo.name)}
	<div
		class="photo absolute {photo.place}"
		style="--tilt: {photo.tilt}deg; --delay: {photo.delay}s; --i: {index + 3}"
		aria-hidden="true"
	>
		<img
			src={asset(`/images/demo/${photo.name}.webp`)}
			alt=""
			width="480"
			height="600"
			fetchpriority={index === 0 ? 'high' : 'low'}
			decoding="async"
			class="aspect-[4/5] w-full rounded-[0.9rem] object-cover"
		/>
	</div>
{/each}

<style>
	.photo {
		z-index: 2;
		padding: 0.4rem;
		border-radius: 1.2rem;
		background: var(--card);
		box-shadow: 0 22px 44px -22px rgb(0 0 0 / 0.45);
		rotate: var(--tilt);
		animation:
			arrive 0.9s cubic-bezier(0.2, 0.75, 0.2, 1) calc(var(--i) * 0.12s + 0.1s) both,
			drift 7s ease-in-out var(--delay) infinite;
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
		.photo {
			animation: none;
		}
	}
</style>
