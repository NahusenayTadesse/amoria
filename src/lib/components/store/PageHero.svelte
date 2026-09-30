<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		kicker: string;
		/** The headline in three runs: plain, the accent word (italic, ribbon colour), plain. */
		before: string;
		accent: string;
		after: string;
		lede: string;
		/** Buttons or links under the lede. */
		actions?: Snippet;
		/** A picture beside the text on wide screens. */
		art?: Snippet;
	};

	let { kicker, before, accent, after, lede, actions, art }: Props = $props();
</script>

<section class="page-hero relative isolate overflow-hidden">
	<div
		class={[
			'mx-auto grid max-w-6xl items-center gap-8 px-4 pt-12 pb-14 sm:px-8 sm:pt-20 sm:pb-20',
			art && 'lg:grid-cols-[1.1fr_0.9fr] lg:gap-12'
		]}
	>
		<div class="relative z-10">
			<p
				class="rise flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase"
				style="--i: 0"
			>
				<span class="h-px w-10 bg-[var(--am-foil)]"></span>
				{kicker}
			</p>
			<h1
				class="display mt-5 text-[2.6rem] leading-[1.03] font-bold text-foreground sm:text-6xl lg:text-7xl"
			>
				<span class="line"><span class="line-in" style="--i: 1">{before}</span></span>
				<span class="line">
					<span class="line-in" style="--i: 2">
						<span class="accent text-[var(--am-ribbon)]">{accent}</span>
						{after}
					</span>
				</span>
			</h1>
			<p class="rise mt-6 max-w-[48ch] text-base text-muted-foreground sm:text-lg" style="--i: 4">
				{lede}
			</p>
			{#if actions}
				<div class="rise mt-8 flex flex-wrap items-center gap-3" style="--i: 5">
					{@render actions()}
				</div>
			{/if}
		</div>
		{#if art}
			<div class="relative mx-auto w-full max-w-[26rem] lg:max-w-none" aria-hidden="true">
				{@render art()}
			</div>
		{/if}
	</div>
</section>

<style>
	.page-hero {
		background:
			radial-gradient(
				52rem 34rem at 92% -12%,
				color-mix(in oklab, var(--am-ribbon) 12%, transparent),
				transparent 60%
			),
			radial-gradient(
				40rem 30rem at -6% 110%,
				color-mix(in oklab, var(--am-foil) 15%, transparent),
				transparent 60%
			),
			var(--background);
	}
</style>
