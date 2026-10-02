<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import PackageMinus from '@lucide/svelte/icons/package-minus';
	import Printer from '@lucide/svelte/icons/printer';
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import type { ColumnDef } from '@tanstack/table-core';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { requisitionHeader, reqLineAdd, reqLineEdit } from '$lib/schemas/inventory';
	import { ethDay } from '$lib/stock';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';
	import RequisitionHeaderFields from '../RequisitionHeaderFields.svelte';

	let { data } = $props();

	const req = $derived(data.req);
	const title = $derived(req.number ?? `Draft requisition #${req.id}`);
	const deciding = $derived(req.status === 'submitted' && data.can.approve);

	// svelte-ignore state_referenced_locally
	const header = data.headerForm
		? createForm(data.headerForm, requisitionHeader, { resetForm: false })
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
		{ name: 'note', label: 'Note', type: 'text', required: false, long: true }
	];

	type Line = (typeof data.lines)[number];
	const columns: ColumnDef<Line>[] = [
		{ accessorKey: 'product', header: 'Product' },
		{ accessorKey: 'quantity', header: 'Asked for', meta: { align: 'right' } },
		{
			accessorKey: 'approvedQuantity',
			header: 'Approved',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.approvedQuantity ?? '—'
		},
		{ accessorKey: 'inStore', header: 'In the store', meta: { align: 'right' } },
		{ accessorKey: 'note', header: 'Note', cell: ({ row }) => row.original.note ?? '' }
	];

	const details = $derived([
		{ name: 'Asked by', value: req.requester },
		{ name: 'For', value: data.purposeLabel },
		...(data.job ? [{ name: 'Décor job', value: data.job }] : []),
		{ name: 'From store', value: data.store },
		{ name: 'Asked on', value: ethDay(req.requestDate) },
		...(req.neededBy ? [{ name: 'Needed by', value: ethDay(req.neededBy) }] : []),
		...(req.note ? [{ name: 'Note', value: req.note, long: 120 }] : []),
		...(req.decidedAt
			? [
					{
						name: req.status === 'rejected' ? 'Rejected by' : 'Decided by',
						value: data.decidedBy ?? '—'
					}
				]
			: []),
		...(req.decisionNote ? [{ name: 'Decision note', value: req.decisionNote, long: 120 }] : [])
	]);
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Requisition" {title} tabTitle="{title} | Amoria">
		{#snippet badges()}
			<Statuses {...data.badge} />
		{/snippet}
		{#snippet actions()}
			{#if data.isDraft}
				<ConfirmAction
					action="?/submit"
					label="Send for approval"
					title="Send this requisition for approval?"
					description="It gets its number and its lines are fixed. Someone else decides it."
					icon={Send}
					disabled={!data.lines.length}
				/>
			{/if}
			{#if req.status === 'approved' && data.can.issue}
				<form method="POST" action="?/issue" use:enhance>
					<Button type="submit"><PackageMinus /> Issue from the store</Button>
				</form>
			{/if}
			{#if !data.isDraft}
				<Button
					variant="outline"
					href={resolve('/dashboard/requisitions/[id]/print', { id: String(req.id) })}
					target="_blank"
				>
					<Printer /> Print
				</Button>
			{/if}
			{#if ['draft', 'submitted', 'approved'].includes(req.status)}
				<ConfirmAction
					action="?/cancel"
					label="Cancel"
					title="Cancel this requisition?"
					description="It stays on record as cancelled."
					variant="outline"
					icon={X}
				/>
			{/if}
		{/snippet}
	</PageHeader>

	<ActionResult />

	{#if req.status === 'submitted' && !data.can.approve}
		<Notice tone="info">Waiting for someone who may approve requisitions.</Notice>
	{/if}
	{#if deciding && data.can.own}
		<Notice tone="warning">
			You sent this requisition. Someone else has to decide it, unless you are an admin.
		</Notice>
	{/if}

	{#if header}
		<form method="POST" action="?/header" use:header.enhance>
			<FormCard title="Details">
				<RequisitionHeaderFields
					form={header.form}
					errors={header.errors}
					locations={data.pickers.locations}
					quotes={data.pickers.quotes}
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

	{#if deciding}
		<PageSection
			title="Decide"
			hint="Approve as asked, or lower a quantity (0 leaves a line out). Rejecting needs a reason."
		>
			<form method="POST" use:enhance class="flex flex-col gap-3">
				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-sm">
						<thead class="bg-muted/50 text-left text-muted-foreground">
							<tr>
								<th class="p-2 font-medium">Product</th>
								<th class="p-2 text-right font-medium">Asked for</th>
								<th class="p-2 text-right font-medium">In the store</th>
								<th class="w-32 p-2 text-right font-medium">Approve</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each data.lines as line (line.id)}
								<tr>
									<td class="p-2">{line.product}</td>
									<td class="p-2 text-right tabular-nums">{line.quantity} {line.unit}</td>
									<td
										class="p-2 text-right tabular-nums {line.inStore < line.quantity
											? 'text-orange-600'
											: ''}">{line.inStore}</td
									>
									<td class="p-2 text-right">
										<Input
											type="number"
											min="0"
											max={line.quantity}
											name="approve_{line.id}"
											value={line.quantity}
											class="h-8 w-28 text-right tabular-nums"
											aria-label="Approve {line.product}"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Input name="note" placeholder="A note, or why it is rejected" class="max-w-lg" />
				<div class="flex flex-wrap gap-2">
					<Button type="submit" formaction="?/approve"><Check /> Approve</Button>
					<Button type="submit" formaction="?/reject" variant="outline"><X /> Reject</Button>
				</div>
			</form>
		</PageSection>
	{/if}

	<PageSection
		title="Materials"
		hint={data.isDraft ? 'What the team needs from the store.' : undefined}
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
				schemas={{ add: reqLineAdd, edit: reqLineEdit }}
			/>
		{:else}
			<DataTable variant="compact" data={data.lines} {columns} />
		{/if}
	</PageSection>

	{#if data.issues.length}
		<PageSection title="Issued" hint="Store issues made for this requisition.">
			<ul class="flex flex-col gap-1 text-sm">
				{#each data.issues as issue (issue.id)}
					<li class="flex items-center gap-2">
						<a
							class="underline"
							href={resolve('/dashboard/stock/documents/[id]', { id: String(issue.id) })}
							>{issue.number ?? `Draft #${issue.id}`}</a
						>
						<Statuses {...issue.badge} />
					</li>
				{/each}
			</ul>
		</PageSection>
	{/if}
</div>
