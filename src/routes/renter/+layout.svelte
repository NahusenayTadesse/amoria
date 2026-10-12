<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import * as Sidebar from '@nahu/admin-kit/components/ui/sidebar/index.js';
	import KitProvider from '@nahu/admin-kit/components/KitProvider.svelte';
	import AppSidebar from '@nahu/admin-kit/components/shell/AppSidebar.svelte';
	import DarkMode from '@nahu/admin-kit/components/shell/DarkMode.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { RENTER_ENTITIES, RENTER_NAVIGATION, renterAccess } from '$lib/renterNavigation';
	import { RENTER_STATUS_BADGE, RENTER_STATUS_LABELS } from '$lib/rentalMarket';

	let { data, children } = $props();
</script>

<ModeWatcher />
<Toaster richColors />

<!-- The renters' own dashboard (§5.12): the kit's shell, with their menu and no staff permissions. -->
<KitProvider
	access={renterAccess}
	navigation={RENTER_NAVIGATION}
	entities={RENTER_ENTITIES}
	permList={[]}
	isSuperAdmin={false}
>
	<Sidebar.Provider>
		<AppSidebar footer="Amoria marketplace">
			{#snippet logo()}
				<div class="flex flex-col items-center gap-1 text-center">
					<img src="/brand/logo.png" alt="Amoria" class="mx-auto h-12 w-auto" />
					<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Renter dashboard
					</span>
				</div>
			{/snippet}
		</AppSidebar>
		<main class="min-w-0 flex-1 px-2">
			<div
				class="sticky top-2 z-50 flex items-center justify-between gap-2 rounded-lg p-2 shadow-lg backdrop-blur-md"
			>
				<div class="flex min-w-0 items-center gap-2">
					<Sidebar.Trigger />
					<span class="truncate text-sm font-semibold">{data.renter.businessName}</span>
					<Statuses
						status={RENTER_STATUS_BADGE[data.renter.status]}
						label={RENTER_STATUS_LABELS[data.renter.status]}
					/>
				</div>
				<div class="flex items-center gap-2">
					{#if data.renter.status === 'approved'}
						<Button
							href={resolve(`/renters/${data.renter.slug}` as AppPath)}
							target="_blank"
							variant="ghost"
							size="sm"
							class="hidden sm:inline-flex"
						>
							<ExternalLink class="size-4" /> My page
						</Button>
					{/if}
					<DarkMode />
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
