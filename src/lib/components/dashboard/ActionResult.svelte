<script lang="ts">
	import { page } from '$app/state';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';

	/**
	 * What the last form action on this page answered: a refusal in words ("Only 2 of Vase at Shop
	 * floor") or a confirmation. Actions return `{ error }` or `{ done }` (`$lib/server/attempt`).
	 */
	const result = $derived(page.form as { error?: string; done?: string } | null);
</script>

{#if result?.error}
	<Notice tone="danger" title="Not done">{result.error}</Notice>
{:else if result?.done}
	<Notice tone="success">{result.done}</Notice>
{/if}
