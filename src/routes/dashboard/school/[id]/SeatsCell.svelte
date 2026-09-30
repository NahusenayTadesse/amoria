<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';

	type Props = { href: string; confirmed: number; awaiting: number; limit: number };
	let { href, confirmed, awaiting, limit }: Props = $props();
</script>

<!-- "5 of 12 seats" with the ones still being paid for beside it; links to that intake's students. -->
<a href={resolve(href as AppPath)} class="text-primary hover:underline">
	{confirmed} of {limit} seats{awaiting ? `, ${awaiting} paying` : ''}
</a>
