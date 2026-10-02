<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Printer from '@lucide/svelte/icons/printer';
	import X from '@lucide/svelte/icons/x';
	import Lock from '@lucide/svelte/icons/lock';
	import type { ColumnDef } from '@tanstack/table-core';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { formatETB } from '@nahu/admin-kit/global';
	import { orderHeader, orderLineAdd, orderLineEdit } from '$lib/schemas/inventory';
	import { ethDay } from '$lib/stock';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';
	import OrderHeaderFields from '../OrderHeaderFields.svelte';

	let { data } = $props();

	const order = $derived(data.order);
	const title = $derived(order.number ?? `Draft order #${order.id}`);
	const canReceive = $derived(['ordered', 'partially_received'].includes(order.status));
	const canClose = $derived(['ordered', 'partially_received', 'received'].includes(order.status));

	// svelte-ignore state_referenced_locally
	const header = data.headerForm
		? createForm(data.headerForm, orderHeader, { resetForm: false })
		: null;
	const headerDelayed = header?.delayed;

	const fields: LookupField[] = [
		{
			name: 'productId',
			label: 'Product',
			type: 'reference',
			options: 'products',
			display: 'product'
		},
		{ name: 'quantity', label: 'How many', type: 'number' },
		{
			name: 'unitCost',
			label: 'Price each',
			type: 'money',
			required: false,
			placeholder: 'Agreed price, if known'
		},
		{ name: 'note', label: 'Note', type: 'text', required: false, long: true }
	];

	type Line = (typeof data.lines)[number];
	const columns: ColumnDef<Line>[] = [
		{ accessorKey: 'product', header: 'Product' },
		{ accessorKey: 'quantity', header: 'Ordered', meta: { align: 'right' } },
		{ accessorKey: 'received', header: 'Received', meta: { align: 'right' } },
		{ accessorKey: 'due', header: 'Still due', meta: { align: 'right' } },
		{
			accessorKey: 'unitCost',
			header: 'Price each',
			meta: { align: 'right' },
			cell: ({ row }) => (row.original.unitCost == null ? '—' : formatETB(row.original.unitCost))
		},
		{
			accessorKey: 'lineTotal',
			header: 'Total',
			meta: { align: 'right' },
			cell: ({ row }) => formatETB(row.original.lineTotal)
		}
	];

	const details = $derived([
		{ name: 'Supplier', value: data.supplier },
		{ name: 'Ordered on', value: ethDay(order.orderDate) },
		...(order.expectedDate ? [{ name: 'Expected on', value: ethDay(order.expectedDate) }] : []),
		{ name: 'Deliver to', value: data.location },
		...(order.reference ? [{ name: 'Your reference', value: order.reference }] : []),
		...(order.note ? [{ name: 'Note', value: order.note, long: 120 }] : [])
	]);
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Purchase order" {title} tabTitle="{title} | Amoria">
		{#snippet badges()}
			<Statuses {...data.badge} />
		{/snippet}
		{#snippet actions()}
			{#if data.isDraft}
				<ConfirmAction
					action="?/order"
					label="Place the order"
					title="Place this order?"
					description="It gets its number and its lines are fixed. Print it or copy it to send to the supplier."
					icon={Check}
					disabled={!data.lines.length}
				/>
				<ConfirmAction
					action="?/cancel"
					label="Drop draft"
					title="Drop this draft order?"
					description="It stays on record as cancelled."
					variant="outline"
					icon={X}
				/>
			{:else}
				{#if canReceive}
					<form method="POST" action="?/receive" use:enhance>
						<Button type="submit"><PackageCheck /> Receive delivery</Button>
					</form>
				{/if}
				<Button
					variant="outline"
					href={resolve('/dashboard/purchasing/[id]/print', { id: String(order.id) })}
					target="_blank"
				>
					<Printer /> Print
				</Button>
				{#if order.status === 'ordered'}
					<ConfirmAction
						action="?/cancel"
						label="Cancel order"
						title="Cancel this order?"
						description="Nothing has arrived on it yet. It stays on record as cancelled."
						variant="outline"
						icon={X}
					/>
				{/if}
				{#if canClose}
					<ConfirmAction
						action="?/close"
						label="Close"
						title="Close this order?"
						description="What is still due stops counting as on order. Use it when the supplier will not send the rest."
						variant="outline"
						icon={Lock}
					/>
				{/if}
			{/if}
		{/snippet}
	</PageHeader>

	<ActionResult />

	{#if header}
		<form method="POST" action="?/header" use:header.enhance>
			<FormCard title="Details">
				<OrderHeaderFields
					form={header.form}
					errors={header.errors}
					suppliers={data.pickers.suppliers}
					locations={data.pickers.locations}
				/>
			</FormCard>
			<div class="mt-3">
				<Button type="submit" variant="outline" size="sm">
					{#if $headerDelayed}<LoadingBtn name="Saving" />{:else}Save details{/if}
				</Button>
			</div>
		</form>
	{:else}
		<PageSection title="Details"><SingleTable singleTable={details} /></PageSection>
	{/if}

	<PageSection
		title="Products ordered"
		hint={data.isDraft
			? 'Add what you are ordering. The price is what you agreed, if you know it.'
			: undefined}
	>
		{#if data.lineSection}
			<LookupSection
				config={{ entity: 'Line', plural: 'Lines', fields }}
				rows={data.lineSection.rows}
				addForm={data.lineSection.addForm}
				editForm={data.lineSection.editForm}
				canDelete
				options={{ productId: data.products }}
				actions={{ add: '?/addLine', edit: '?/editLine', delete: '?/deleteLine' }}
				schemas={{ add: orderLineAdd, edit: orderLineEdit }}
			/>
		{:else}
			<DataTable variant="compact" data={data.lines} {columns} />
		{/if}
		<p class="mt-3 text-right text-sm tabular-nums">
			<span class="text-muted-foreground">Order value</span>
			<strong class="ml-3">{formatETB(data.total)}</strong>
		</p>
	</PageSection>

	{#if data.receipts.length}
		<PageSection title="Deliveries" hint="Goods receipts against this order.">
			<ul class="flex flex-col gap-1 text-sm">
				{#each data.receipts as r (r.id)}
					<li class="flex items-center gap-2">
						<a
							class="underline"
							href={resolve('/dashboard/stock/documents/[id]', { id: String(r.id) })}
							>{r.number ?? `Draft #${r.id}`}</a
						>
						<Statuses {...r.badge} />
					</li>
				{/each}
			</ul>
		</PageSection>
	{/if}
</div>
