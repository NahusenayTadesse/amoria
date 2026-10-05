<!--
	A thin gold line across the top while a page is loading. Pages fetch their data on the server,
	so a tap can wait a moment; this is the "something is happening" an app gives. It waits a beat
	before showing, so quick loads do not flash.
-->
<script lang="ts">
	import { navigating } from '$app/state';

	let show = $state(false);

	$effect(() => {
		if (!navigating.to) {
			show = false;
			return;
		}
		const timer = setTimeout(() => (show = true), 120);
		return () => clearTimeout(timer);
	});
</script>

{#if show}
	<div
		role="progressbar"
		aria-label="Loading"
		class="fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-transparent pt-[env(safe-area-inset-top)]"
	>
		<div class="progress h-full w-1/3 bg-[var(--am-gold)]"></div>
	</div>
{/if}

<style>
	.progress {
		animation: slide 1s ease-in-out infinite;
	}
	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.progress {
			animation: none;
			width: 100%;
		}
	}
</style>
