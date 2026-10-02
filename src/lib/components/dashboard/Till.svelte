<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { lineTotal, roundBirr, sumBirr } from '$lib/money';

	/**
	 * The selling screen. The basket lives here in the browser; the whole sale (lines and payments)
	 * is posted in one go, and the server prices it, takes the stock and records the money in a
	 * single transaction, so nothing typed here is trusted for an amount that matters.
	 */
	type Found = {
		id: number;
		name: string;
		sku: string | null;
		barcode: string | null;
		price: number;
		unit: string;
		onFloor: number;
	};
	type Item = {
		productId: number;
		name: string;
		unit: string;
		onFloor: number;
		price: number;
		unitPrice: number;
		quantity: number;
	};
	type Payment = { method: string; amount: number | ''; reference: string };
	type Sale = { documentId: number; number: string; total: number; change: number };

	let {
		canDiscount,
		vat,
		methods
	}: {
		canDiscount: boolean;
		vat: { registered: boolean; rate: number; included: boolean };
		methods: { value: string; name: string }[];
	} = $props();

	let query = $state('');
	let results = $state<Found[]>([]);
	let basket = $state<Item[]>([]);
	let payments = $state<Payment[]>([{ method: 'cash', amount: '', reference: '' }]);
	let sale = $state<Sale | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let searchBox = $state<HTMLInputElement | null>(null);

	const total = $derived(sumBirr(basket.map((i) => lineTotal(i.unitPrice, i.quantity))));
	const numeric = (p: Payment) => (p.amount === '' ? 0 : Number(p.amount) || 0);
	const cash = $derived(sumBirr(payments.filter((p) => p.method === 'cash').map(numeric)));
	const other = $derived(sumBirr(payments.filter((p) => p.method !== 'cash').map(numeric)));
	const paid = $derived(roundBirr(cash + other));
	const change = $derived(paid > total ? roundBirr(paid - total) : 0);
	const due = $derived(paid < total ? roundBirr(total - paid) : 0);
	const overNonCash = $derived(other > total);
	const canSell = $derived(
		basket.length > 0 && due === 0 && !overNonCash && change <= cash && !busy
	);

	let seq = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	async function find(text: string): Promise<Found[]> {
		const mine = ++seq;
		const res = await fetch(`${resolve('/dashboard/pos/search')}?q=${encodeURIComponent(text)}`);
		const body = (await res.json()) as { results: Found[] };
		// A slower, older answer must not replace a newer one.
		return mine === seq ? body.results : results;
	}

	function onInput() {
		clearTimeout(timer);
		if (!query.trim()) {
			results = [];
			return;
		}
		timer = setTimeout(async () => (results = await find(query)), 180);
	}

	function add(found: Found) {
		const existing = basket.find((i) => i.productId === found.id);
		if (existing) existing.quantity += 1;
		else
			basket.push({
				productId: found.id,
				name: found.name,
				unit: found.unit,
				onFloor: found.onFloor,
				price: found.price,
				unitPrice: found.price,
				quantity: 1
			});
		sale = null;
		error = null;
	}

	/** Enter: an exact barcode or SKU adds at once (a scanner ends its digits with Enter). */
	async function onEnter() {
		// The search typing started would otherwise land after the scan and reopen the list.
		clearTimeout(timer);
		const text = query.trim();
		if (!text) return;
		const list = await find(text);
		const exact = list.find((f) => f.barcode === text || f.sku === text);
		if (exact || list.length === 1) {
			add(exact ?? list[0]);
			query = '';
			results = [];
		} else {
			results = list;
		}
	}

	function reset() {
		basket = [];
		payments = [{ method: 'cash', amount: '', reference: '' }];
		query = '';
		results = [];
		error = null;
		searchBox?.focus();
	}

	const submit = () => {
		busy = true;
		error = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (options?: { reset?: boolean }) => Promise<void>;
		}) => {
			busy = false;
			if (result.type === 'success') {
				sale = result.data?.sale as Sale;
				toast.success(String(result.data?.done ?? 'Sold'));
				basket = [];
				payments = [{ method: 'cash', amount: '', reference: '' }];
				await update({ reset: false });
				searchBox?.focus();
			} else if (result.type === 'failure') {
				error = String(result.data?.error ?? 'That did not work.');
			} else {
				await update({ reset: false });
			}
		};
	};

	const payload = $derived(
		JSON.stringify({
			lines: basket.map((i) => ({
				productId: i.productId,
				quantity: i.quantity,
				...(i.unitPrice !== i.price ? { unitPrice: i.unitPrice } : {})
			})),
			payments: payments
				.filter((p) => numeric(p) > 0)
				.map((p) => ({
					method: p.method,
					amount: numeric(p),
					...(p.reference.trim() ? { reference: p.reference.trim() } : {})
				}))
		})
	);

	function onKey(event: KeyboardEvent) {
		if (event.key === 'F2') {
			event.preventDefault();
			searchBox?.focus();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
	<section class="flex flex-col gap-3" aria-label="Basket">
		<div class="relative">
			<ScanBarcode class="absolute top-2.5 left-3 size-4 text-muted-foreground" />
			<Input
				bind:ref={searchBox}
				bind:value={query}
				oninput={onInput}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						onEnter();
					}
				}}
				type="search"
				placeholder="Scan a barcode, or type a name or code (F2)"
				class="h-11 pl-9 text-base"
				autocomplete="off"
				aria-label="Find a product"
			/>
			{#if results.length}
				<ul
					class="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
				>
					{#each results as found (found.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
								onclick={() => {
									add(found);
									query = '';
									results = [];
									searchBox?.focus();
								}}
							>
								<span>
									{found.name}
									<span class="text-xs text-muted-foreground">
										{found.sku ?? ''}{found.sku && found.barcode ? ' · ' : ''}{found.barcode ?? ''}
									</span>
								</span>
								<span class="text-right text-sm tabular-nums">
									{formatETB(found.price)}
									<span
										class="block text-xs {found.onFloor > 0
											? 'text-muted-foreground'
											: 'text-red-600'}"
									>
										{found.onFloor} on the floor
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-left text-muted-foreground">
					<tr>
						<th class="p-2 font-medium">Product</th>
						<th class="w-36 p-2 text-center font-medium">Qty</th>
						<th class="w-28 p-2 text-right font-medium">Price</th>
						<th class="w-28 p-2 text-right font-medium">Total</th>
						<th class="w-10 p-2"><span class="sr-only">Remove</span></th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each basket as item, i (item.productId)}
						<tr>
							<td class="p-2">
								{item.name}
								{#if item.quantity > item.onFloor}
									<div class="text-xs text-red-600">
										Only {item.onFloor} on the floor. Move more out from the store first.
									</div>
								{/if}
							</td>
							<td class="p-2">
								<div class="flex items-center justify-center gap-1">
									<Button
										type="button"
										size="icon"
										variant="outline"
										class="size-8"
										aria-label="One fewer {item.name}"
										onclick={() => (item.quantity = Math.max(1, item.quantity - 1))}
									>
										<Minus />
									</Button>
									<Input
										type="number"
										min="1"
										bind:value={item.quantity}
										class="h-8 w-14 text-center tabular-nums"
										aria-label="Quantity of {item.name}"
									/>
									<Button
										type="button"
										size="icon"
										variant="outline"
										class="size-8"
										aria-label="One more {item.name}"
										onclick={() => (item.quantity += 1)}
									>
										<Plus />
									</Button>
								</div>
							</td>
							<td class="p-2 text-right">
								{#if canDiscount}
									<Input
										type="number"
										min="0"
										step="0.01"
										bind:value={item.unitPrice}
										class="h-8 w-24 text-right tabular-nums"
										aria-label="Price of {item.name}"
									/>
								{:else}
									<span class="tabular-nums">{formatETB(item.unitPrice)}</span>
								{/if}
							</td>
							<td class="p-2 text-right tabular-nums">
								{formatETB(lineTotal(item.unitPrice, item.quantity))}
							</td>
							<td class="p-2 text-right">
								<Button
									type="button"
									size="icon"
									variant="ghost"
									class="size-8"
									aria-label="Remove {item.name}"
									onclick={() => basket.splice(i, 1)}
								>
									<Trash2 />
								</Button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="p-6 text-center text-muted-foreground">
								Scan or search to start a sale.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="flex flex-col gap-3 rounded-lg border p-4" aria-label="Payment">
		{#if sale}
			<Notice tone="success" title="Sold {sale.number}">
				{formatETB(sale.total)}{sale.change ? `, change ${formatETB(sale.change)}` : ''}.
				<a
					class="underline"
					href={resolve('/dashboard/pos/receipt/[id]', { id: String(sale.documentId) })}
					target="_blank"
				>
					<Printer class="inline size-3.5" /> Receipt
				</a>
			</Notice>
		{/if}
		{#if error}<Notice tone="danger" title="Not sold">{error}</Notice>{/if}

		<div class="flex items-baseline justify-between">
			<span class="text-muted-foreground">Total</span>
			<span class="text-3xl font-semibold tabular-nums">{formatETB(total)}</span>
		</div>
		{#if vat.registered && basket.length}
			<p class="text-xs text-muted-foreground">
				Prices {vat.included ? 'include' : `have ${vat.rate}% VAT added to them on`} standard-rated products.
			</p>
		{/if}

		<div class="flex flex-col gap-2">
			{#each payments as payment, i (i)}
				<div class="grid grid-cols-[1fr_7rem] gap-2">
					<select
						bind:value={payment.method}
						class="h-9 rounded-md border bg-background px-2 text-sm"
						aria-label="Payment method {i + 1}"
					>
						{#each methods as m (m.value)}
							<option value={m.value}>{m.name}</option>
						{/each}
					</select>
					<Input
						type="number"
						min="0"
						step="0.01"
						bind:value={payment.amount}
						placeholder="0.00"
						class="h-9 text-right tabular-nums"
						aria-label="Amount paid by method {i + 1}"
					/>
					{#if payment.method !== 'cash'}
						<Input
							bind:value={payment.reference}
							placeholder="Reference (optional)"
							class="col-span-2 h-8 text-xs"
							aria-label="Payment reference {i + 1}"
						/>
					{/if}
				</div>
			{/each}
			<div class="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={!basket.length}
					onclick={() => (payments = [{ method: 'cash', amount: total, reference: '' }])}
				>
					Exact cash
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					disabled={payments.length >= 6}
					onclick={() => payments.push({ method: 'telebirr', amount: due || '', reference: '' })}
				>
					<Plus /> Split payment
				</Button>
			</div>
		</div>

		<dl class="grid grid-cols-2 gap-y-1 text-sm tabular-nums">
			<dt class="text-muted-foreground">Paid</dt>
			<dd class="text-right">{formatETB(paid)}</dd>
			{#if due}
				<dt class="text-orange-700">Still to pay</dt>
				<dd class="text-right font-semibold text-orange-700">{formatETB(due)}</dd>
			{/if}
			{#if change}
				<dt class="font-semibold">Change</dt>
				<dd class="text-right text-lg font-semibold">{formatETB(change)}</dd>
			{/if}
		</dl>
		{#if overNonCash}
			<p class="text-sm text-red-600">Only cash gives change. Lower the other payments.</p>
		{/if}

		<form method="POST" action="?/sell" use:enhance={submit} class="flex gap-2">
			<input type="hidden" name="payload" value={payload} />
			<Button type="submit" class="h-11 flex-1 text-base" disabled={!canSell}>
				{busy ? 'Selling…' : 'Complete sale'}
			</Button>
			<Button type="button" variant="outline" class="h-11" onclick={reset} disabled={busy}>
				Clear
			</Button>
		</form>
	</section>
</div>
