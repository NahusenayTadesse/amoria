<!--
	The shop itself: the storefront photo with the gold signboard under it, beside a line inviting
	people in. Photos are Amoria's own, served from static/images/shop.
-->
<script lang="ts">
	import { responsive } from '$lib/img';

	const front = responsive('/images/shop/shopfront.webp', 640, 1280);
	const sign = responsive('/images/shop/sign-en.webp', 640, 1280);
	import { m } from '$lib/paraglide/messages.js';
	import { reveal } from '$lib/actions/reveal';
</script>

<section class="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
	<div class="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
		<figure use:reveal class="relative">
			<img
				src={front.src}
				srcset={front.srcset}
				sizes="(min-width: 1024px) 560px, 92vw"
				alt={m.photo_shopfront_alt()}
				width="1280"
				height="960"
				loading="lazy"
				decoding="async"
				class="aspect-[4/3] w-full rounded-[1.75rem] object-cover shadow-[0_40px_70px_-40px_var(--am-ink)]"
			/>
			<span
				class="absolute -right-2 -bottom-2 -z-10 h-full w-full rounded-[1.75rem] border-2 border-[var(--am-foil)]/50 sm:-right-4 sm:-bottom-4"
				aria-hidden="true"
			></span>
		</figure>

		<div use:reveal style="--i: 1">
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase">
				{m.home_visit_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.home_visit_heading()}
			</h2>
			<p class="mt-5 max-w-[46ch] text-base text-muted-foreground sm:text-lg">
				{m.home_visit_body()}
			</p>
			<img
				src={sign.src}
				srcset={sign.srcset}
				sizes="(min-width: 1024px) 420px, 92vw"
				alt={m.photo_sign_alt()}
				width="1280"
				height="266"
				loading="lazy"
				decoding="async"
				class="mt-8 w-full rounded-xl shadow-[0_24px_40px_-28px_var(--am-ink)]"
			/>
		</div>
	</div>
</section>
