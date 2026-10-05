<script lang="ts">
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { m } from '$lib/paraglide/messages.js';

	let offline = $state(false);

	onMount(() => {
		const sync = () => (offline = !navigator.onLine);
		sync();
		addEventListener('online', sync);
		addEventListener('offline', sync);
		return () => {
			removeEventListener('online', sync);
			removeEventListener('offline', sync);
		};
	});
</script>

{#if offline}
	<div
		role="status"
		transition:fly={{ y: -20, duration: 200 }}
		class="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 mx-auto flex max-w-md items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm text-background shadow-lg"
	>
		<WifiOff class="h-4 w-4 shrink-0" aria-hidden="true" />
		{m.offline_banner()}
	</div>
{/if}
