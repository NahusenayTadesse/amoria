<script lang="ts">
	import type { Component } from 'svelte';
	import { setBag, type Bag } from '../bag.svelte';

	/**
	 * Test harness: renders a store component inside a bag context, as the shop page provides.
	 * Never used by the app.
	 */
	type Props = {
		bag: Bag;
		component: Component<Record<string, unknown>>;
		innerProps: Record<string, unknown>;
	};
	let { bag, component: Inner, innerProps }: Props = $props();

	// svelte-ignore state_referenced_locally
	setBag(bag);
</script>

<Inner {...innerProps} />
