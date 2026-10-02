<script lang="ts">
	import { page } from '$app/state';
	import { SvelteURL } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import type { ColumnDef } from '@tanstack/table-core';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import ReportChart from '@nahu/admin-kit/components/reports/ReportChart.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { STOCK_REASON_META, ethDay } from '$lib/stock';
	import PeriodBar from '$lib/components/dashboard/PeriodBar.svelte';

	let { data } = $props();

	const money = (n: number | null | undefined) => (n == null ? '—' : formatETB(n));
	const right = { align: 'right' } as const;

	function tab(name: string) {
		const url = new SvelteURL(page.url);
		url.pathname = `/dashboard/reports/${name}`;
		url.searchParams.delete('product');
		url.searchParams.delete('idle');
		url.searchParams.delete('by');
		return `${url.pathname}${url.search}`;
	}

	const title = $derived(
		'name' in data && data.name ? data.reports[data.name as keyof typeof data.reports] : 'Reports'
	);

	/* ---- column sets, one per table ---- */
	type NamedValue = { name: string; quantity: number; value: number };
	const valueColumns: ColumnDef<NamedValue>[] = [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'quantity', header: 'Units', meta: right },
		{
			accessorKey: 'value',
			header: 'Worth',
			meta: right,
			cell: ({ row }) => money(row.original.value)
		}
	];

	type Used = { product: string; used: number; unit: string; cost: number };
	const usedColumns: ColumnDef<Used>[] = [
		{ accessorKey: 'product', header: 'Product' },
		{
			accessorKey: 'used',
			header: 'Used',
			meta: right,
			cell: ({ row }) => `${row.original.used} ${row.original.unit}`
		},
		{
			accessorKey: 'cost',
			header: 'At cost',
			meta: right,
			cell: ({ row }) => money(row.original.cost)
		}
	];

	type WriteOff = { reason: string; quantity: number; cost: number; lines: number };
	const writeOffColumns: ColumnDef<WriteOff>[] = [
		{
			accessorKey: 'reason',
			header: 'Reason',
			cell: ({ row }) =>
				STOCK_REASON_META[row.original.reason as keyof typeof STOCK_REASON_META]?.label ??
				row.original.reason
		},
		{ accessorKey: 'quantity', header: 'Units', meta: right },
		{ accessorKey: 'lines', header: 'Times', meta: right },
		{
			accessorKey: 'cost',
			header: 'Cost',
			meta: right,
			cell: ({ row }) => money(row.original.cost)
		}
	];

	type Supplier = {
		supplier: string;
		orders: number;
		ordered: number;
		received: number;
		fillRate: number | null;
		deliveredValue: number;
	};
	const supplierColumns: ColumnDef<Supplier>[] = [
		{ accessorKey: 'supplier', header: 'Supplier' },
		{ accessorKey: 'orders', header: 'Orders', meta: right },
		{ accessorKey: 'ordered', header: 'Ordered', meta: right },
		{ accessorKey: 'received', header: 'Received', meta: right },
		{
			accessorKey: 'fillRate',
			header: 'Filled',
			meta: right,
			cell: ({ row }) => (row.original.fillRate == null ? '—' : `${row.original.fillRate}%`)
		},
		{
			accessorKey: 'deliveredValue',
			header: 'Delivered (cost)',
			meta: right,
			cell: ({ row }) => money(row.original.deliveredValue)
		}
	];

	type Slow = {
		product: string;
		onHand: number;
		unit: string;
		value: number;
		daysIdle: number;
		neverUsed: boolean;
	};
	const slowColumns: ColumnDef<Slow>[] = [
		{ accessorKey: 'product', header: 'Product' },
		{
			accessorKey: 'onHand',
			header: 'On hand',
			meta: right,
			cell: ({ row }) => `${row.original.onHand} ${row.original.unit}`
		},
		{
			accessorKey: 'daysIdle',
			header: 'Days idle',
			meta: right,
			cell: ({ row }) => `${row.original.daysIdle}${row.original.neverUsed ? ' (never used)' : ''}`
		},
		{
			accessorKey: 'value',
			header: 'Tied up',
			meta: right,
			cell: ({ row }) => money(row.original.value)
		}
	];

	type Abc = { name: string; amount: number; share: number; cumulative: number; class: string };
	const abcColumns: ColumnDef<Abc>[] = [
		{ accessorKey: 'class', header: 'Class' },
		{ accessorKey: 'name', header: 'Product' },
		{
			accessorKey: 'amount',
			header: 'Amount',
			meta: right,
			cell: ({ row }) => money(row.original.amount)
		},
		{
			accessorKey: 'share',
			header: 'Share',
			meta: right,
			cell: ({ row }) => `${row.original.share}%`
		},
		{
			accessorKey: 'cumulative',
			header: 'Running total',
			meta: right,
			cell: ({ row }) => `${row.original.cumulative}%`
		}
	];

	type Out = { name: string; from: string; to: string | null; days: number };
	const outColumns: ColumnDef<Out>[] = [
		{ accessorKey: 'name', header: 'Product' },
		{ accessorKey: 'from', header: 'Ran out', cell: ({ row }) => ethDay(row.original.from) },
		{
			accessorKey: 'to',
			header: 'Back in stock',
			cell: ({ row }) => (row.original.to ? ethDay(row.original.to) : 'Still out')
		},
		{ accessorKey: 'days', header: 'Days', meta: right }
	];

	type SalesRegister = {
		number: string | null;
		type: string;
		day: string;
		subtotal: number | null;
		vatTotal: number | null;
		total: number | null;
	};
	const salesRegisterColumns: ColumnDef<SalesRegister>[] = [
		{ accessorKey: 'number', header: 'Number' },
		{
			accessorKey: 'type',
			header: 'Kind',
			cell: ({ row }) => (row.original.type === 'sales_return' ? 'Refund' : 'Sale')
		},
		{ accessorKey: 'day', header: 'Date', cell: ({ row }) => ethDay(row.original.day) },
		{
			accessorKey: 'subtotal',
			header: 'Before VAT',
			meta: right,
			cell: ({ row }) => money(row.original.subtotal)
		},
		{
			accessorKey: 'vatTotal',
			header: 'VAT',
			meta: right,
			cell: ({ row }) => money(row.original.vatTotal)
		},
		{
			accessorKey: 'total',
			header: 'Total',
			meta: right,
			cell: ({ row }) => money(row.original.total)
		}
	];
	type PurchaseRegister = {
		number: string | null;
		day: string;
		supplier: string;
		tin: string | null;
		net: number;
		vat: number;
	};
	const purchaseRegisterColumns: ColumnDef<PurchaseRegister>[] = [
		{ accessorKey: 'number', header: 'Number' },
		{ accessorKey: 'day', header: 'Date', cell: ({ row }) => ethDay(row.original.day) },
		{ accessorKey: 'supplier', header: 'Supplier' },
		{ accessorKey: 'tin', header: 'TIN', cell: ({ row }) => row.original.tin ?? '—' },
		{
			accessorKey: 'net',
			header: 'Before VAT',
			meta: right,
			cell: ({ row }) => money(row.original.net)
		},
		{
			accessorKey: 'vat',
			header: 'Input VAT',
			meta: right,
			cell: ({ row }) => money(row.original.vat)
		}
	];

	const stat = (
		key: string,
		label: string,
		value: number,
		format: 'money' | 'count',
		extra: { tone?: 'positive' | 'negative' | 'neutral' | 'warning'; hint?: string } = {}
	) => ({ key, label, value, format, group: 'reports', ...extra });
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		{title}
		tabTitle="{title} | Amoria"
		description={data.view.kind === 'overview'
			? 'How the stock is doing, and where to look next.'
			: undefined}
	/>

	<nav class="flex flex-wrap gap-1 text-sm" aria-label="Reports">
		<a
			href={resolve('/dashboard/reports')}
			aria-current={data.view.kind === 'overview' ? 'page' : undefined}
			class={[
				'rounded-md px-3 py-1.5',
				data.view.kind === 'overview'
					? 'bg-muted font-semibold'
					: 'text-muted-foreground hover:bg-accent'
			]}>Overview</a
		>
		{#each Object.entries(data.reports) as [key, label] (key)}
			<a
				href={resolve(tab(key) as AppPath)}
				aria-current={data.view.kind === key ? 'page' : undefined}
				class={[
					'rounded-md px-3 py-1.5',
					data.view.kind === key
						? 'bg-muted font-semibold'
						: 'text-muted-foreground hover:bg-accent'
				]}>{label}</a
			>
		{/each}
	</nav>

	{#if data.view.kind !== 'overview' && data.view.kind !== 'value' && data.view.kind !== 'slow'}
		<PeriodBar from={data.period.from} to={data.period.to} />
	{/if}

	{#if data.view.kind === 'overview'}
		{@const v = data.view}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				stat={stat('value', 'Stock worth', v.stockValue, 'money', { hint: 'At average cost' })}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('sales', 'Sales, last 30 days', v.sales30, 'money', {
					tone: 'positive',
					hint: 'Online and till, less refunds'
				})}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('low', 'Low or out of stock', v.low, 'count', {
					tone: v.low ? 'warning' : 'neutral'
				})}
			/>
			<StatCard
				stat={stat('expiring', 'Expired or expiring', v.expiring, 'count', {
					tone: v.expiring ? 'negative' : 'neutral'
				})}
			/>
			<StatCard
				stat={stat('slow', 'Tied up in slow stock', v.slowValue, 'money', {
					tone: v.slowCount ? 'warning' : 'neutral',
					hint: `${v.slowCount} products idle 90+ days`
				})}
				amharicMoney={false}
			/>
		</div>
		<ul class="grid gap-2 text-sm sm:grid-cols-2">
			{#each Object.entries(data.reports) as [key, label] (key)}
				<li>
					<a
						class="block rounded-lg border p-3 hover:bg-accent"
						href={resolve(`/dashboard/reports/${key}` as AppPath)}
					>
						{label}
					</a>
				</li>
			{/each}
		</ul>
	{:else if data.view.kind === 'value'}
		{@const v = data.view}
		<div class="grid gap-3 sm:grid-cols-3">
			<StatCard stat={stat('total', 'Stock worth', v.total, 'money')} amharicMoney={false} />
		</div>
		<ReportChart
			chart={{
				key: 'category',
				title: 'By category',
				group: 'reports',
				kind: 'doughnut',
				labels: v.byCategory.map((c) => c.name),
				series: [{ label: 'Worth', data: v.byCategory.map((c) => c.value) }],
				money: true
			}}
		/>
		<PageSection title="By location">
			<DataTable variant="compact" data={v.byLocation} columns={valueColumns} />
		</PageSection>
		<PageSection title="By product">
			<DataTable data={v.byProduct} columns={valueColumns} fileName="Stock value" />
		</PageSection>
	{:else if data.view.kind === 'movement'}
		{@const v = data.view}
		<ReportChart
			chart={{
				key: 'movement',
				title: v.byMonth ? 'Units in and out, by Ethiopian month' : 'Units in and out, by day',
				group: 'reports',
				kind: 'bar',
				labels: v.points.map((p) => p.label),
				series: [
					{ label: 'In', data: v.points.map((p) => p.inQty) },
					{ label: 'Out', data: v.points.map((p) => p.outQty) }
				],
				wide: true
			}}
		/>
		<p class="text-sm text-muted-foreground">
			Moves between locations are left out: they change where stock is, not how much there is.
		</p>
	{:else if data.view.kind === 'usage'}
		<DataTable data={data.view.rows} columns={usedColumns} fileName="Most used" />
	{:else if data.view.kind === 'write-offs'}
		{@const v = data.view}
		<ReportChart
			chart={{
				key: 'writeoffs',
				title: 'Cost by reason',
				group: 'reports',
				kind: 'doughnut',
				labels: v.rows.map((r) => STOCK_REASON_META[r.reason]?.label ?? r.reason),
				series: [{ label: 'Cost', data: v.rows.map((r) => r.cost) }],
				money: true
			}}
		/>
		<DataTable variant="compact" data={v.rows} columns={writeOffColumns} />
	{:else if data.view.kind === 'buying'}
		<DataTable data={data.view.rows} columns={supplierColumns} fileName="Suppliers" />
	{:else if data.view.kind === 'sales'}
		{@const v = data.view}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				stat={stat('online', 'Online orders', v.summary.online.total, 'money', {
					hint: `${v.summary.online.count} paid orders`
				})}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('till', 'Till sales', v.summary.till.total, 'money', {
					hint: `${v.summary.till.count} sales`
				})}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('refunds', 'Refunds', v.summary.till.refunded, 'money', {
					tone: v.summary.till.refunded ? 'warning' : 'neutral'
				})}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('net', 'Net sales', v.summary.net, 'money', { tone: 'positive' })}
				amharicMoney={false}
			/>
		</div>
		<PageSection title="Best sellers by revenue">
			<DataTable variant="compact" data={v.top} columns={abcColumns} />
		</PageSection>
	{:else if data.view.kind === 'slow'}
		{@const v = data.view}
		<form method="GET" class="flex flex-wrap items-end gap-3 text-sm">
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">Not used for at least (days)</span>
				<input
					name="idle"
					type="number"
					min="1"
					value={v.days}
					class="h-9 w-32 rounded-md border bg-background px-3"
				/>
			</label>
			<button class="h-9 rounded-md border px-3 hover:bg-accent" type="submit">Show</button>
		</form>
		<DataTable data={v.rows} columns={slowColumns} fileName="Slow-moving stock" />
	{:else if data.view.kind === 'abc'}
		{@const v = data.view}
		<nav class="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="Ranked by">
			{#each [{ key: 'cost', label: 'By cost used' }, { key: 'revenue', label: 'By revenue' }] as option (option.key)}
				<a
					class={[
						'rounded-md px-3 py-1.5',
						v.by === option.key ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground'
					]}
					href={resolve(
						`${page.url.pathname}?from=${data.period.from}&to=${data.period.to}&by=${option.key}` as AppPath
					)}>{option.label}</a
				>
			{/each}
		</nav>
		<p class="text-sm text-muted-foreground">
			A products are the few that account for 80% of the total, B the next 15%, C the rest.
		</p>
		<DataTable data={v.rows} columns={abcColumns} fileName="ABC analysis" />
	{:else if data.view.kind === 'stock-outs'}
		<DataTable data={data.view.rows} columns={outColumns} fileName="Stock-outs" />
	{:else if data.view.kind === 'trend'}
		{@const v = data.view}
		<form method="GET" class="flex flex-wrap items-end gap-3 text-sm">
			<input type="hidden" name="from" value={data.period.from} />
			<input type="hidden" name="to" value={data.period.to} />
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">Product</span>
				<select
					name="product"
					class="h-9 min-w-64 rounded-md border bg-background px-3"
					onchange={(e) => e.currentTarget.form?.submit()}
				>
					<option value="">Choose a product…</option>
					{#each v.products as p (p.value)}
						<option value={p.value} selected={v.productId === p.value}>{p.name}</option>
					{/each}
				</select>
			</label>
		</form>
		{#if v.trend}
			<ReportChart
				chart={{
					key: 'trend',
					title: `${v.name}: units on hand`,
					description:
						v.trend.reorderLevel != null ? `Reorder level ${v.trend.reorderLevel}` : undefined,
					group: 'reports',
					kind: 'line',
					labels: ['Start', ...v.trend.points.map((p) => p.day)],
					series: [
						{
							label: 'On hand',
							data: [v.trend.opening, ...v.trend.points.map((p) => p.quantity)]
						},
						...(v.trend.reorderLevel != null
							? [
									{
										label: 'Reorder level',
										data: Array(v.trend.points.length + 1).fill(v.trend.reorderLevel)
									}
								]
							: [])
					],
					wide: true
				}}
			/>
		{:else}
			<Notice tone="info">Choose a product to see its stock level over the period.</Notice>
		{/if}
	{:else if data.view.kind === 'vat'}
		{@const v = data.view}
		{#if !v.registered}
			<Notice tone="info">
				The shop is not marked as VAT-registered in Settings, so till sales carry no VAT. Turn it on
				there when it is.
			</Notice>
		{/if}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				stat={stat('out', 'Output VAT (till)', v.outputVat, 'money', {
					hint: 'Sales less refunds'
				})}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('in', 'Input VAT', v.inputVat, 'money', { hint: 'On deliveries' })}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat(
					'due',
					v.payable >= 0 ? 'VAT payable' : 'VAT to reclaim',
					Math.abs(v.payable),
					'money',
					{
						tone: v.payable > 0 ? 'warning' : 'positive'
					}
				)}
				amharicMoney={false}
			/>
			<StatCard
				stat={stat('net', 'Till sales before VAT', v.salesNet, 'money')}
				amharicMoney={false}
			/>
		</div>
		{#if v.registered && v.onlineVatEstimate}
			<Notice tone="warning" title="Online sales">
				Online orders keep no tax record, so their VAT is estimated from each product's tax code
				today: about {formatETB(v.onlineVatEstimate, false)}. It is not in the figures above.
			</Notice>
		{/if}
		<PageSection title="Sales register">
			<DataTable data={v.salesRegister} columns={salesRegisterColumns} fileName="Sales register" />
		</PageSection>
		<PageSection title="Purchases register">
			<DataTable
				data={v.purchasesRegister}
				columns={purchaseRegisterColumns}
				fileName="Purchases register"
			/>
		</PageSection>
	{/if}
</div>
