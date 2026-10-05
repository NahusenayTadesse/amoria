<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import Share from '@lucide/svelte/icons/share';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { install } from '$lib/install.svelte';

	type Props = { class?: string; compact?: boolean; tone?: 'dark' | 'light' };
	let { class: className = '', compact = false, tone = 'dark' }: Props = $props();

	let steps: HTMLDialogElement | undefined = $state();

	onMount(() => install.start());

	async function choose() {
		if (!(await install.prompt())) steps?.showModal();
	}
</script>

{#if install.available}
	<button
		type="button"
		onclick={choose}
		aria-label={compact ? m.install_app() : undefined}
		class={[
			'inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--am-gold)] active:scale-[0.97]',
			tone === 'dark'
				? 'border border-[var(--am-gold)]/60 text-[var(--am-gold)] hover:bg-[var(--am-gold)] hover:text-[var(--am-ink)]'
				: 'bg-[var(--am-ribbon)] text-white',
			className
		]}
	>
		<Download class="h-4 w-4 shrink-0" aria-hidden="true" />
		<span class={compact ? 'max-lg:sr-only' : ''}>{m.install_app()}</span>
	</button>

	{#if install.needsSteps}
		<dialog
			bind:this={steps}
			class="m-auto w-[min(92vw,24rem)] rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl backdrop:bg-black/50"
		>
			<h2 class="display text-xl font-bold">{m.install_ios_title()}</h2>
			<ol class="mt-4 grid gap-3 text-sm">
				<li class="flex items-start gap-3">
					<Share class="mt-0.5 h-5 w-5 shrink-0 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.install_ios_step1()}
				</li>
				<li class="flex items-start gap-3">
					<SquarePlus class="mt-0.5 h-5 w-5 shrink-0 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.install_ios_step2()}
				</li>
				<li class="flex items-start gap-3">
					<Download class="mt-0.5 h-5 w-5 shrink-0 text-[var(--am-ribbon)]" aria-hidden="true" />
					{m.install_ios_step3()}
				</li>
			</ol>
			<form method="dialog" class="mt-6">
				<button
					class="h-11 w-full rounded-full bg-[var(--am-ribbon)] text-sm font-semibold text-white"
				>
					{m.install_close()}
				</button>
			</form>
		</dialog>
	{/if}
{/if}
