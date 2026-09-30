<script lang="ts">
	type Props = {
		label: string;
		/** `done` for money received, `wait` for something still to happen, `over` for ended. */
		tone: 'done' | 'wait' | 'over';
	};

	let { label, tone }: Props = $props();
</script>

<span
	class={[
		'rounded-full px-3 py-1 text-sm font-semibold',
		tone === 'done' && 'bg-[#e3f1e6] text-[#1d5b2c]',
		tone === 'wait' && 'bg-[#f7ecd6] text-[#7a5410]',
		tone === 'over' && 'bg-secondary text-muted-foreground'
	]}
>
	{label}
</span>
