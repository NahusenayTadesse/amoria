<script lang="ts">
	import { resolve } from '$app/paths';
	/** The settings screens, as links so each is its own URL. */
	let { current }: { current: 'shop' | 'areas' | 'accounts' } = $props();

	const tabs = [
		{ key: 'shop', href: '/dashboard/settings', label: 'Shop settings' },
		{ key: 'areas', href: '/dashboard/settings/delivery-areas', label: 'Delivery areas' },
		{ key: 'accounts', href: '/dashboard/settings/bank-accounts', label: 'Bank accounts' }
	] as const;
</script>

<div class="flex flex-wrap items-end justify-between gap-3">
	<h1 class="text-2xl font-semibold">Settings</h1>
	<nav class="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="Settings">
		{#each tabs as tab (tab.key)}
			<a
				href={resolve(tab.href)}
				aria-current={current === tab.key ? 'page' : undefined}
				class={[
					'rounded-md px-3 py-1.5',
					current === tab.key ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground'
				]}>{tab.label}</a
			>
		{/each}
	</nav>
</div>
