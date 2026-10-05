<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';

	type Props = { id: number; label: string };
	let { id, label }: Props = $props();
</script>

<a
	href={resolve(`/dashboard/quote-requests/${id}` as AppPath)}
	class="font-medium text-primary underline-offset-4 hover:underline"
>
	{label}
</a>
