<script lang="ts">
	import { resolve } from '$app/paths';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import { formatETB } from '@nahu/admin-kit/global';
	import PhotoManager from '$lib/components/dashboard/PhotoManager.svelte';
	import { bundleItemAdd, bundleItemEdit } from '$lib/schemas/catalog';

	let { data } = $props();

	const b = $derived(data.bundle);
	const s = $derived(data.summary);
	const custom = $derived(b.type === 'custom');

	/** A box customers fill: its price depends on what they put in, so only the container's shows. */
	const boxStats = $derived([
		{
			key: 'container',
			label: 'The container',
			value: data.container?.price ?? 0,
			format: 'money' as const,
			group: 'price',
			hint: data.container?.name ?? 'None chosen'
		},
		{
			key: 'discount',
			label: 'Discount on every box',
			value: b.discountPercent,
			format: 'count' as const,
			group: 'price',
			hint: 'Percent off the container and the gifts chosen'
		},
		{
			key: 'boxes',
			label: 'Containers in stock',
			value: data.container?.stockQty ?? 0,
			format: 'count' as const,
			group: 'stock',
			hint: 'Each box sold takes one',
			tone: (data.container?.stockQty ?? 0) === 0 ? ('warning' as const) : ('neutral' as const)
		}
	]);

	const stats = $derived(
		custom
			? boxStats
			: [
					{
						key: 'full',
						label: 'Gifts bought separately',
						value: s.full,
						format: 'money' as const,
						group: 'price',
						hint: 'Today’s prices of everything in it'
					},
					{
						key: 'price',
						label: 'Bundle price',
						value: s.price,
						format: 'money' as const,
						group: 'price',
						hint: `${b.discountPercent}% off`
					},
					{
						key: 'saving',
						label: 'Customer saves',
						value: s.saving,
						format: 'money' as const,
						group: 'price'
					},
					{
						key: 'sets',
						label: 'Can sell now',
						value: s.sets,
						format: 'count' as const,
						group: 'stock',
						hint: 'Whole bundles the stock makes: the scarcest gift decides',
						tone: s.sets === 0 ? ('warning' as const) : ('neutral' as const)
					}
				]
	);

	const ruleText = (rule: { minQty: number; maxQty: number }) =>
		rule.minQty > 0 ? `${rule.minQty} to ${rule.maxQty}` : `up to ${rule.maxQty}`;

	const fields: LookupField[] = [
		{
			name: 'productId',
			label: 'Gift',
			type: 'reference',
			options: 'gifts',
			display: 'product',
			picker: 'combo'
		},
		{ name: 'qty', label: 'How many', type: 'number' },
		{ name: 'price', label: 'Price each', type: 'money', inForm: false },
		{ name: 'lineTotal', label: 'Together', type: 'money', inForm: false },
		{ name: 'stockQty', label: 'In stock', type: 'number', inForm: false }
	];
</script>

<svelte:head>
	<title>{b.name} | Amoria</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<a href={resolve('/dashboard/bundles')} class="text-sm text-muted-foreground hover:underline"
			>Bundles</a
		>
		<span class="text-muted-foreground">/</span>
		<h1 class="text-2xl font-semibold">{b.name}</h1>
		<Statuses
			status={b.isActive ? 'active' : 'inactive'}
			label={b.isActive ? (b.publishedAt ? 'On the shop' : 'Hidden') : 'Inactive'}
		/>
	</div>
	<p class="text-muted-foreground">
		{custom ? 'Built by customers' : 'Ready-made'}{data.container
			? `, in ${data.container.name}`
			: ''}. {b.discountPercent}% off the gifts’ total{data.categoryName
			? `, also under ${data.categoryName}`
			: ''}.
		{#if b.nameAm}<span lang="am">({b.nameAm})</span>{/if}
		Change the name, discount or visibility from the
		<a href={resolve('/dashboard/bundles')} class="text-primary hover:underline">bundles list</a>.
	</p>

	{#if s.offSale.length}
		<p
			class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
			role="alert"
		>
			{s.offSale.join(', ')}
			{s.offSale.length === 1 ? 'is' : 'are'} no longer for sale, so the shop hides this bundle. Switch
			{s.offSale.length === 1 ? 'it' : 'them'} back on, or take {s.offSale.length === 1
				? 'it'
				: 'them'} out of the bundle.
		</p>
	{/if}

	{#if s.problems.length}
		<div
			class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
			role="alert"
		>
			<p>The gifts do not fit the container's rules, so the shop hides this bundle:</p>
			<ul class="mt-1 list-disc pl-5">
				{#each s.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</div>

	{#if data.container}
		<PageSection
			title="What fits in {data.container.name}"
			hint={custom
				? 'Customers fill the container within these rules; the shop’s builder and the checkout both hold them to it.'
				: 'The gifts below must fit these rules.'}
		>
			{#if data.container.rules.length}
				<ul class="flex flex-col divide-y rounded-md border text-sm">
					{#each data.container.rules as rule (rule.id)}
						<li class="flex justify-between gap-3 px-3 py-2">
							<span
								>{rule.name}
								<span class="text-xs text-muted-foreground">({rule.about})</span></span
							>
							<span class="tabular-nums">{ruleText(rule)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-destructive">
					This container has no rules, so nothing can go in it.
				</p>
			{/if}
			<p class="mt-2 text-sm">
				<a
					class="text-primary hover:underline"
					href={resolve('/dashboard/products/[id]', { id: String(data.container.id) })}
					>Change the rules on {data.container.name}’s page</a
				>
			</p>
		</PageSection>
	{/if}

	{#if data.itemSection}
		<PageSection
			title="What is in it"
			hint="Each gift once, with how many of it. The price above follows these gifts’ prices; selling one bundle takes every gift in it from stock."
		>
			<LookupSection
				config={{ entity: 'Gift', plural: 'Gifts', fields }}
				rows={data.itemSection.rows}
				addForm={data.itemSection.addForm}
				editForm={data.itemSection.editForm}
				canDelete
				options={{ productId: data.giftOptions }}
				actions={{ add: '?/addItem', edit: '?/editItem', delete: '?/deleteItem' }}
				schemas={{ add: bundleItemAdd, edit: bundleItemEdit }}
			/>
			{#if data.itemSection.rows.length}
				<p class="mt-3 text-right text-sm tabular-nums">
					<span class="text-muted-foreground line-through">{formatETB(s.full)}</span>
					<span class="ml-2 font-semibold">{formatETB(s.price)}</span>
				</p>
			{/if}
		</PageSection>
	{/if}

	<PhotoManager
		photos={data.images}
		canRemove={data.isSuperAdmin}
		mainUse="the featured photo: on the bundle's card and at the top of its page in the shop"
		emptyText="The shop shows a wrapped-gift placeholder until you add one."
	/>
</div>
