<script lang="ts">
	import { resolve } from '$app/paths';
	/** The two stock views. Links, so each is its own URL. */
	let { current }: { current: 'levels' | 'ledger' } = $props();
</script>

<div class="flex flex-wrap items-end justify-between gap-3">
	<h1 class="text-2xl font-semibold">Stock</h1>
	<nav class="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="Stock views">
		<a
			href={resolve('/dashboard/stock')}
			aria-current={current === 'levels' ? 'page' : undefined}
			class={[
				'rounded-md px-3 py-1.5',
				current === 'levels' ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground'
			]}>Levels</a
		>
		<a
			href={resolve('/dashboard/stock/ledger')}
			aria-current={current === 'ledger' ? 'page' : undefined}
			class={[
				'rounded-md px-3 py-1.5',
				current === 'ledger' ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground'
			]}>Ledger</a
		>
	</nav>
</div>
