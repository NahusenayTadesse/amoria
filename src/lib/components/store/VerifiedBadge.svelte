<script lang="ts">
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import { m } from '$lib/paraglide/messages.js';

	/**
	 * "Verified business": Amoria checked this renter's TIN and trade licence before approving
	 * them (§5.12). Every renter shown to guests is approved, so it is always true where it shows.
	 */
	type Props = { compact?: boolean; class?: string };
	let { compact = false, class: className = '' }: Props = $props();
</script>

<span
	class={[
		'inline-flex items-center gap-1 font-semibold text-[var(--am-ribbon)]',
		compact ? 'text-xs' : 'text-sm',
		className
	]}
	title={m.market_verified_hint()}
>
	<BadgeCheck class={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
	{compact ? m.market_verified_short() : m.market_verified()}
</span>
