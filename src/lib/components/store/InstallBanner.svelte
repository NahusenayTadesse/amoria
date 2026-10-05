<!--
	Asks once, politely, at a good moment: from a visitor's second visit on, above the tab bar, with a
	"Not now" that is remembered for 30 days. Nothing shows when the app is installed or cannot be.
-->
<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { m } from '$lib/paraglide/messages.js';
	import { install } from '$lib/install.svelte';
	import InstallButton from './InstallButton.svelte';

	const DISMISSED = 'amoria-install-dismissed';
	const VISITS = 'amoria-visits';
	const QUIET_DAYS = 30;

	let eligible = $state(false);

	onMount(() => {
		install.start();
		try {
			// One visit is one browser session; the banner waits for the second.
			let visits = Number(localStorage.getItem(VISITS) ?? 0);
			if (!sessionStorage.getItem(VISITS)) {
				sessionStorage.setItem(VISITS, '1');
				localStorage.setItem(VISITS, String(++visits));
			}
			const dismissed = Number(localStorage.getItem(DISMISSED) ?? 0);
			eligible = visits >= 2 && Date.now() - dismissed > QUIET_DAYS * 864e5;
		} catch {
			// Storage blocked: never nag.
		}
	});

	function dismiss() {
		eligible = false;
		try {
			localStorage.setItem(DISMISSED, String(Date.now()));
		} catch {
			// The banner is gone for this visit.
		}
	}
</script>

{#if eligible && install.available}
	<div
		transition:fly={{ y: 40, duration: 200 }}
		class="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[var(--am-ink)] p-3 pl-4 text-white shadow-xl sm:bottom-6 sm:left-auto"
		role="region"
		aria-label={m.install_app()}
	>
		<img
			src="/brand/icons/icon-192.png"
			alt=""
			width="40"
			height="40"
			class="h-10 w-10 rounded-xl"
		/>
		<p class="min-w-0 flex-1 text-sm leading-snug">{m.install_banner()}</p>
		<InstallButton />
		<button
			type="button"
			onclick={dismiss}
			aria-label={m.install_dismiss()}
			class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70 active:bg-white/10"
		>
			<X class="h-4 w-4" aria-hidden="true" />
		</button>
	</div>
{/if}
