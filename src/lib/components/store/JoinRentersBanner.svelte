<!-- For businesses: the way into the marketplace (§5.12), on the rental and renter pages. -->
<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { reveal } from '$lib/actions/reveal';
</script>

<aside
	use:reveal
	class="grid gap-6 overflow-hidden rounded-[1.75rem] bg-[var(--am-ink)] p-7 text-white sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center"
>
	<div>
		<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase">
			{m.market_join_kicker()}
		</p>
		<h2 class="display mt-3 text-3xl leading-tight font-bold sm:text-4xl">
			{m.market_join_heading()}
		</h2>
		<p class="mt-3 max-w-[52ch] text-white/75">{m.market_join_body()}</p>
	</div>
	<div class="flex lg:justify-end">
		<a
			href={resolve(localizeHref('/renters/join') as AppPath)}
			class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-foil)] px-7 text-[0.95rem] font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
		>
			{m.market_join_cta()}
			<ArrowRight
				class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
				aria-hidden="true"
			/>
		</a>
	</div>
</aside>
