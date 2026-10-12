<script lang="ts">
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/**
	 * Every permission as a ticked or unticked box, grouped by area, each in words with its code
	 * under it. Posts the ticked ids as `permissionIds` with whatever form it sits in.
	 *
	 * With `readonly` it only shows what is held, for a role or person the viewer may not change.
	 */
	type Permission = { id: number; name: string; description: string | null };
	let {
		permissions,
		checked,
		readonly = false,
		name = 'permissionIds'
	}: {
		permissions: Permission[];
		/** The ids ticked when the page loaded. */
		checked: number[];
		readonly?: boolean;
		name?: string;
	} = $props();

	const AREAS: Record<string, string> = {
		orders: 'Orders',
		payments: 'Payments',
		catalog: 'Catalog',
		quotes: 'Décor quotes',
		school: 'School',
		stock: 'Stock',
		purchasing: 'Purchasing',
		requisitions: 'Requisitions',
		pos: 'Till',
		reports: 'Reports',
		data: 'Data',
		settings: 'Settings',
		staff: 'Admin panel'
	};

	// svelte-ignore state_referenced_locally
	const ticked = new SvelteSet(checked);

	const groups = $derived(
		[...new Set(permissions.map((p) => p.name.split('.')[0]))].map((area) => ({
			area,
			label: AREAS[area] ?? area,
			list: permissions.filter((p) => p.name.split('.')[0] === area)
		}))
	);

	function toggle(id: number, on: boolean) {
		if (on) ticked.add(id);
		else ticked.delete(id);
	}

	function setAll(on: boolean) {
		for (const p of permissions) toggle(p.id, on);
	}
</script>

<div class="flex flex-col gap-4">
	{#if !readonly}
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<span class="text-muted-foreground">{ticked.size} of {permissions.length} ticked.</span>
			<Button type="button" size="sm" variant="ghost" onclick={() => setAll(true)}>Tick all</Button>
			<Button type="button" size="sm" variant="ghost" onclick={() => setAll(false)}>Clear</Button>
		</div>
	{/if}
	<div class="grid gap-4 md:grid-cols-2">
		{#each groups as group (group.area)}
			<fieldset class="rounded-lg border p-3">
				<legend class="px-1 text-sm font-semibold">{group.label}</legend>
				<ul class="flex flex-col gap-2">
					{#each group.list as p (p.id)}
						<li>
							<label for="perm-{p.id}" class="flex items-start gap-3 text-sm">
								<!-- The kit's checkbox posts `name` = the id when ticked, as a native one would. -->
								<Checkbox
									id="perm-{p.id}"
									{name}
									value={String(p.id)}
									checked={ticked.has(p.id)}
									disabled={readonly}
									onCheckedChange={(checked) => toggle(p.id, checked)}
									class="mt-0.5"
								/>
								<span>
									<span class="block">{p.description ?? p.name}</span>
									<span class="block font-mono text-xs text-muted-foreground">{p.name}</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
			</fieldset>
		{/each}
	</div>
</div>
