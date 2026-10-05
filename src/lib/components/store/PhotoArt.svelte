<!--
	A pair of framed photographs for a page hero's picture slot: the big one tilted one way, a
	smaller one overlapping its corner the other way. Decorative: PageHero hides its art from
	screen readers, so the images carry no alt text.
-->
<script lang="ts">
	import { responsive } from '$lib/img';

	type Photo = { src: string; w: number; h: number; small: number };
	type Props = { main: Photo; side: Photo };

	let { main, side }: Props = $props();

	const mainImg = $derived(responsive(main.src, main.small, main.w));
	const sideImg = $derived(responsive(side.src, side.small, side.w));
</script>

<div class="relative mx-auto aspect-[4/4.2] w-full max-w-[34rem]">
	<img
		src={mainImg.src}
		srcset={mainImg.srcset}
		sizes="(min-width: 1024px) 460px, 80vw"
		alt=""
		width={main.w}
		height={main.h}
		decoding="async"
		class="absolute top-0 left-0 h-[78%] w-[82%] -rotate-2 rounded-[1.5rem] border-[6px] border-white object-cover shadow-[0_30px_60px_-30px_var(--am-ink)]"
	/>
	<img
		src={sideImg.src}
		srcset={sideImg.srcset}
		sizes="(min-width: 1024px) 220px, 45vw"
		alt=""
		width={side.w}
		height={side.h}
		loading="lazy"
		decoding="async"
		class="absolute right-0 bottom-0 h-[52%] w-[48%] rotate-3 rounded-[1.25rem] border-[6px] border-white object-cover shadow-[0_24px_50px_-24px_var(--am-ink)]"
	/>
</div>
