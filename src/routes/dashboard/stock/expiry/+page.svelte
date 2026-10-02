<script lang="ts">
	import { enhance } from '$app/forms';
	import PackageX from '@lucide/svelte/icons/package-x';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { ethDay } from '$lib/stock';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';

	let { data } = $props();

	const STATE = {
		expired: { status: 'failed', label: 'Expired' },
		expiring: { status: 'pending', label: 'Expiring' },
		flagged: { status: 'declined', label: 'Set aside' }
	} as const;
	const LOT_ACTIONS = [
		{ value: 'available', name: 'Fine to sell' },
		{ value: 'quarantine', name: 'Pull off sale' },
		{ value: 'recalled', name: 'Recalled' }
	];
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Expiry"
		tabTitle="Expiry | Amoria"
		description="Lots that have expired, expire within {data.warningDays} days, or were pulled or recalled. Expired stock is never sold. Move it into quarantine or write it off."
	/>

	<ActionResult />

	{#if !data.groups.length}
		<Empty title="Nothing expired or expiring soon." />
	{/if}

	{#each data.groups as group (group.id)}
		<PageSection title={group.name}>
			{#snippet actions()}
				{#if data.canAct && group.expired && group.kind !== 'quarantine'}
					<ConfirmAction
						action="?/quarantine"
						fields={{ locationId: group.id }}
						label="Move expired to quarantine"
						title="Move the expired stock here into quarantine?"
						description="A transfer is drafted for you to check and post. Nothing moves until you post it."
						variant="outline"
						icon={ShieldAlert}
					/>
				{/if}
				{#if data.canAct && group.expired}
					<ConfirmAction
						action="?/writeOff"
						fields={{ locationId: group.id }}
						label="Write expired off"
						title="Write off the expired stock here?"
						description="An adjustment is drafted for you to check and post."
						variant="outline"
						icon={PackageX}
					/>
				{/if}
			{/snippet}
			<div class="overflow-x-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead class="bg-muted/50 text-left text-muted-foreground">
						<tr>
							<th class="p-2 font-medium">Product</th>
							<th class="p-2 font-medium">Lot</th>
							<th class="p-2 font-medium">Expires</th>
							<th class="p-2 text-right font-medium">Days</th>
							<th class="p-2 text-right font-medium">Qty</th>
							<th class="p-2 font-medium">State</th>
							{#if data.canAct}<th class="p-2 font-medium">Lot</th>{/if}
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each group.rows as row (`${row.lotId}-${row.locationId}`)}
							<tr>
								<td class="p-2">{row.product}</td>
								<td class="p-2">{row.lotNumber}</td>
								<td class="p-2">{row.expiryDate ? ethDay(row.expiryDate) : '—'}</td>
								<td class="p-2 text-right tabular-nums">
									{Number.isFinite(row.daysLeft) ? row.daysLeft : '—'}
								</td>
								<td class="p-2 text-right tabular-nums">{row.quantity}</td>
								<td class="p-2">
									<Statuses {...STATE[row.state]} />
									{#if row.lotStatus !== 'available'}
										<span class="ml-1 text-xs text-muted-foreground">
											{row.lotStatus === 'recalled' ? 'recalled' : 'pulled'}
										</span>
									{/if}
								</td>
								{#if data.canAct}
									<td class="p-2">
										<form method="POST" action="?/lot" use:enhance class="flex gap-1">
											<input type="hidden" name="lotId" value={row.lotId} />
											<select
												name="status"
												class="h-8 rounded-md border bg-background px-2 text-xs"
												aria-label="What to do with lot {row.lotNumber}"
											>
												{#each LOT_ACTIONS as a (a.value)}
													<option value={a.value} selected={row.lotStatus === a.value}
														>{a.name}</option
													>
												{/each}
											</select>
											<Button type="submit" size="sm" variant="outline">Set</Button>
										</form>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</PageSection>
	{/each}
</div>
