<!--
	The home page's gallery: a masonry of wedding, hall and garden photos. Site design, served from
	static/images/demo. Demo stock photos for now (scripts/demo-images.sh) — replace with Amoria's
	own before launch.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { reveal } from '$lib/actions/reveal';

	/**
	 * Ordered so the three columns come out even (two portraits and a landscape, or the tall
	 * centrepiece and three landscapes each). The sizes keep the columns still while photos load.
	 */
	const photos = [
		{ name: 'gallery-hall-drapes', w: 900, h: 599, caption: m.home_gallery_hall_drapes },
		{ name: 'gallery-garden-reception', w: 900, h: 1350, caption: m.home_gallery_garden_reception },
		{ name: 'gallery-ceremony-chairs', w: 900, h: 1350, caption: m.home_gallery_ceremony_chairs },
		{ name: 'gallery-floral-tables', w: 900, h: 601, caption: m.home_gallery_floral_tables },
		{ name: 'gallery-gold-letters', w: 900, h: 1350, caption: m.home_gallery_gold_letters },
		{ name: 'gallery-aisle-chairs', w: 900, h: 1350, caption: m.home_gallery_aisle_chairs },
		{ name: 'gallery-centerpiece', w: 900, h: 1440, caption: m.home_gallery_centerpiece },
		{ name: 'gallery-long-table', w: 900, h: 600, caption: m.home_gallery_long_table },
		{ name: 'gallery-table-garden', w: 900, h: 600, caption: m.home_gallery_table_garden },
		{ name: 'gallery-evening-hall', w: 900, h: 600, caption: m.home_gallery_evening_hall }
	];
</script>

<section class="bg-[var(--am-ink)] py-20 text-white sm:py-28">
	<div class="mx-auto max-w-6xl px-4 sm:px-8">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[#e6c473] uppercase">
				{m.home_gallery_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.home_gallery_heading()}
			</h2>
			<p class="mt-4 max-w-[52ch] text-white/70 sm:text-lg">{m.home_gallery_body()}</p>
		</div>

		<ul class="mt-10 columns-2 gap-3 sm:mt-14 sm:gap-5 lg:columns-3">
			{#each photos as photo, index (photo.name)}
				<li use:reveal style="--i: {index % 3}" class="mb-3 break-inside-avoid sm:mb-5">
					<figure class="group relative overflow-hidden rounded-[1.1rem] bg-white/5">
						<img
							src={asset(`/images/demo/${photo.name}.webp`)}
							alt={photo.caption()}
							width={photo.w}
							height={photo.h}
							loading="lazy"
							decoding="async"
							class="h-auto w-full transition-transform duration-[1100ms] ease-out group-hover:scale-[1.05]"
						/>
						<figcaption
							aria-hidden="true"
							class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 text-sm font-medium sm:p-4 sm:pt-12 sm:text-base"
						>
							{photo.caption()}
						</figcaption>
					</figure>
				</li>
			{/each}
		</ul>
	</div>
</section>
