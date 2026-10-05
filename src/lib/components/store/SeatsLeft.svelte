<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	type Props = {
		/** Seats still free, counted on the server. */
		count: number;
		/** From this many down, the badge turns urgent. */
		fewAt?: number;
	};

	let { count, fewAt = 3 }: Props = $props();

	const full = $derived(count <= 0);
	const few = $derived(!full && count <= fewAt);
</script>

<span
	class={[
		'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
		full && 'bg-secondary text-muted-foreground',
		few && 'bg-[#e6f1e9] text-[var(--am-ribbon)]',
		!full && !few && 'bg-[#e3f1e6] text-[#1d5b2c]'
	]}
>
	<!-- A pulse on the last few seats: the one thing on the page that asks for a decision. -->
	<span class="relative flex h-2 w-2" aria-hidden="true">
		{#if few}
			<span class="pulse absolute inline-flex h-full w-full rounded-full bg-current opacity-60"
			></span>
		{/if}
		<span class="relative inline-flex h-2 w-2 rounded-full bg-current"></span>
	</span>
	{#if full}
		{m.school_full()}
	{:else if count === 1}
		{m.school_last_seat()}
	{:else}
		{m.school_seats_left({ count })}
	{/if}
</span>

<style>
	.pulse {
		animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
	@keyframes ping {
		75%,
		100% {
			transform: scale(2.4);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
