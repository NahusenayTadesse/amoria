<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import * as Sidebar from '@nahu/admin-kit/components/ui/sidebar/index.js';
	import KitProvider from '@nahu/admin-kit/components/KitProvider.svelte';
	import AppSidebar from '@nahu/admin-kit/components/shell/AppSidebar.svelte';
	import Search from '@nahu/admin-kit/components/shell/Search.svelte';
	import DarkMode from '@nahu/admin-kit/components/shell/DarkMode.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { access } from '$lib/access';
	import { ENTITIES, NAVIGATION } from '$lib/navigation';

	let { data, children } = $props();
</script>

<ModeWatcher />
<Toaster richColors />

<KitProvider
	{access}
	navigation={NAVIGATION}
	entities={ENTITIES}
	permList={data.permList}
	isSuperAdmin={data.isSuperAdmin}
>
	<Sidebar.Provider>
		<AppSidebar footer="Built by PulseData Solutions">
			{#snippet logo()}
				<span class="text-lg font-bold">Amoria</span>
			{/snippet}
		</AppSidebar>
		<main class="min-w-0 flex-1 px-2">
			<div
				class="sticky top-2 z-50 flex items-center justify-between rounded-lg p-2 shadow-lg backdrop-blur-md"
			>
				<Sidebar.Trigger />
				<div class="flex items-center gap-2">
					<Search />
					<DarkMode />
					<span class="hidden text-sm text-muted-foreground sm:inline">{data.user.name}</span>
					<form method="POST" action="/logout">
						<Button type="submit" variant="ghost" size="sm">Sign out</Button>
					</form>
				</div>
			</div>
			<div class="p-2 pt-4">
				{@render children()}
			</div>
		</main>
	</Sidebar.Provider>
</KitProvider>
