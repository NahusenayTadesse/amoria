<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import Printer from '@lucide/svelte/icons/printer';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import X from '@lucide/svelte/icons/x';
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
	import { documentHeader, docLineAdd, docLineEdit } from '$lib/schemas/inventory';
	import { ADJUSTMENT_REASON_LABELS, STOCK_REASON_META, ethDay } from '$lib/stock';
	import ActionResult from '$lib/components/dashboard/ActionResult.svelte';
	import DocumentHeaderFields from '$lib/components/dashboard/DocumentHeaderFields.svelte';

	let { data } = $props();

	const doc = $derived(data.doc);
	const title = $derived(doc.number ?? `Draft ${data.typeLabel.toLowerCase()} #${doc.id}`);

	// The header form is for drafts only; it is built once from what the page loaded.
	// svelte-ignore state_referenced_locally
	const header = data.headerForm
		? createForm(data.headerForm, documentHeader, { resetForm: false })
		: null;
	const headerDelayed = header?.delayed;

	const product: LookupField = {
		name: 'productId',
		label: 'Product',
		type: 'reference',
		options: 'products',
		display: 'product'
	};
	const quantity = $derived<LookupField>({
		name: 'quantity',
		label: doc.type === 'adjustment' ? 'How many (minus removes)' : 'How many',
		type: 'number'
	});
	const cost: LookupField = {
		name: 'unitCost',
		label: 'Cost each',
		type: 'money',
		required: false,
		placeholder: 'Empty: the average cost'
	};
	const price: LookupField = {
		name: 'unitPrice',
		label: 'Price each',
		type: 'money',
		required: false,
		placeholder: 'Empty: for internal use, no sale'
	};
	const lotNumber: LookupField = {
		name: 'lotNumber',
		label: 'Lot number',
		type: 'text',
		required: false,
		placeholder: 'For products that track lots'
	};
	const expiry: LookupField = {
		name: 'expiryDate',
		label: 'Expires',
		type: 'date',
		required: false
	};
	const fromLot: LookupField = {
		name: 'lotId',
		label: 'From lot',
		type: 'reference',
		options: 'lots',
		display: 'lot',
		required: false
	};
	const note: LookupField = {
		name: 'note',
		label: 'Note',
		type: 'text',
		required: false,
		long: true
	};

	const lineFields = $derived<LookupField[]>(
		doc.type === 'receipt'
			? [product, quantity, cost, lotNumber, expiry, note]
			: doc.type === 'issue'
				? [product, quantity, price, fromLot, note]
				: doc.type === 'transfer'
					? [product, quantity, fromLot, note]
					: [product, quantity, fromLot, lotNumber, expiry, cost, note]
	);
	// A return's lines were made from the original: only how many can be changed.
	const returnFields: LookupField[] = [
		{ name: 'product', label: 'Product', type: 'text', inForm: false },
		{ name: 'quantity', label: 'Coming back', type: 'number' }
	];

	type Line = (typeof data.lines)[number];
	const postedColumns: ColumnDef<Line>[] = [
		{ accessorKey: 'product', header: 'Product' },
		{ accessorKey: 'quantity', header: 'Qty', meta: { align: 'right' } },
		{
			accessorKey: 'unitCost',
			header: 'Cost each',
			meta: { align: 'right' },
			cell: ({ row }) => (row.original.unitCost == null ? '—' : formatETB(row.original.unitCost))
		},
		{
			accessorKey: 'unitPrice',
			header: 'Price each',
			meta: { align: 'right' },
			cell: ({ row }) => (row.original.unitPrice == null ? '—' : formatETB(row.original.unitPrice))
		},
		{
			id: 'lot',
			header: 'Lot',
			cell: ({ row }) => row.original.lot ?? row.original.lotNumber ?? '—'
		},
		{
			accessorKey: 'expiryDate',
			header: 'Expires',
			cell: ({ row }) => (row.original.expiryDate ? ethDay(row.original.expiryDate) : '—')
		}
	];

	type Movement = (typeof data.movements)[number];
	const movementColumns: ColumnDef<Movement>[] = [
		{ accessorKey: 'product', header: 'Product' },
		{ accessorKey: 'location', header: 'Location' },
		{ id: 'lot', header: 'Lot', cell: ({ row }) => row.original.lot ?? '—' },
		{
			accessorKey: 'delta',
			header: 'Change',
			meta: { align: 'right' },
			cell: ({ row }) => (row.original.delta > 0 ? `+${row.original.delta}` : row.original.delta)
		},
		{
			accessorKey: 'reason',
			header: 'Reason',
			cell: ({ row }) => STOCK_REASON_META[row.original.reason]?.label ?? row.original.reason
		},
		{
			accessorKey: 'unitCost',
			header: 'Valued at',
			meta: { align: 'right' },
			cell: ({ row }) => formatETB(row.original.unitCost)
		}
	];

	const details = $derived([
		{ name: 'Date', value: ethDay(doc.docDate) },
		...(data.where.from ? [{ name: 'From', value: data.where.from }] : []),
		...(data.where.to ? [{ name: 'To', value: data.where.to }] : []),
		...(data.where.supplier ? [{ name: 'Supplier', value: data.where.supplier }] : []),
		...(doc.party ? [{ name: 'For', value: doc.party }] : []),
		...(doc.reference ? [{ name: 'Reference', value: doc.reference }] : []),
		...(doc.reason ? [{ name: 'Why', value: ADJUSTMENT_REASON_LABELS[doc.reason] }] : []),
		...(doc.note ? [{ name: 'Note', value: doc.note, long: 120 }] : [])
	]);

	const canReturn = $derived(
		!data.isDraft && doc.status === 'posted' && (doc.type === 'issue' || doc.type === 'receipt')
	);
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow={data.typeLabel} {title} tabTitle="{title} | Amoria">
		{#snippet badges()}
			<Statuses {...data.badge} />
		{/snippet}
		{#snippet actions()}
			{#if data.isDraft}
				<ConfirmAction
					action="?/post"
					label="Post"
					title="Post this {data.typeLabel.toLowerCase()}?"
					description="Stock changes now, and a posted document cannot be edited. Mistakes are corrected with another document."
					icon={Check}
				/>
				<ConfirmAction
					action="?/cancel"
					label="Drop draft"
					title="Drop this draft?"
					description="It stays on record as cancelled and changes no stock."
					variant="outline"
					icon={X}
				/>
			{:else}
				<Button
					variant="outline"
					href={resolve('/dashboard/stock/documents/[id]/print', { id: String(doc.id) })}
					target="_blank"
				>
					<Printer /> Print
				</Button>
				{#if canReturn}
					<form method="POST" action="?/draftReturn" use:enhance>
						<Button type="submit" variant="outline">
							<Undo2 />
							{doc.type === 'issue' ? 'Customer return' : 'Return to supplier'}
						</Button>
					</form>
				{/if}
			{/if}
		{/snippet}
		{#if data.original}
			Returns
			<a
				class="underline"
				href={resolve('/dashboard/stock/documents/[id]', { id: String(data.original.id) })}
				>{data.original.number}</a
			>.
		{/if}
	</PageHeader>

	<ActionResult />

	{#if header}
		{#if !data.isReturn}
			<form method="POST" action="?/header" use:header.enhance>
				<FormCard title="Details">
					<DocumentHeaderFields
						form={header.form}
						errors={header.errors}
						type={doc.type as 'receipt' | 'issue' | 'transfer' | 'adjustment'}
						locations={data.pickers.locations}
						suppliers={data.pickers.suppliers}
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
	{:else}
		<PageSection title="Details"><SingleTable singleTable={details} /></PageSection>
	{/if}

	<PageSection
		title="Lines"
		hint={data.isDraft
			? data.isReturn
				? 'Lower a quantity to what actually came back, or remove a line.'
				: 'What is in this document. Nothing here changes stock until it is posted.'
			: undefined}
	>
		{#if data.lineSection}
			<LookupSection
				config={{
					entity: 'Line',
					plural: 'Lines',
					fields: data.isReturn ? returnFields : lineFields
				}}
				rows={data.lineSection.rows}
				addForm={data.lineSection.addForm}
				editForm={data.lineSection.editForm}
				canDelete
				options={{ productId: data.options.products, lotId: data.options.lots }}
				actions={{
					add: '?/addLine',
					edit: data.isReturn ? '?/editReturnLine' : '?/editLine',
					delete: '?/deleteLine'
				}}
				schemas={{ add: docLineAdd, edit: docLineEdit }}
				readonly={data.isReturn}
			/>
		{:else}
			<DataTable variant="compact" data={data.lines} columns={postedColumns} />
		{/if}

		{#if doc.total != null}
			<dl class="mt-3 ml-auto grid max-w-xs grid-cols-2 gap-x-6 text-sm tabular-nums">
				<dt class="text-muted-foreground">Before VAT</dt>
				<dd class="text-right">{formatETB(doc.subtotal ?? 0)}</dd>
				<dt class="text-muted-foreground">VAT</dt>
				<dd class="text-right">{formatETB(doc.vatTotal ?? 0)}</dd>
				<dt class="font-semibold">Total</dt>
				<dd class="text-right font-semibold">{formatETB(doc.total)}</dd>
			</dl>
		{/if}
	</PageSection>

	{#if data.movements.length}
		<PageSection
			title="What it moved"
			hint="The ledger rows this document wrote when it was posted."
		>
			<DataTable variant="compact" data={data.movements} columns={movementColumns} />
		</PageSection>
	{/if}

	{#if data.returnsMade.length}
		<PageSection title="Returns">
			<ul class="flex flex-col gap-1 text-sm">
				{#each data.returnsMade as r (r.id)}
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
