<!--
	The inside of a build-your-own box, in the product sheet: one section per container rule, with
	how full it is and the gifts that count towards it, each with a stepper that stops at the rule's
	limit and the stock.
-->
<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { birr, localized } from '$lib/localized';
	import type { BoxDraft } from './boxDraft.svelte';

	type Props = { draft: BoxDraft };
	let { draft }: Props = $props();

	const box = $derived(localized(draft.offer.container, 'name'));
</script>

<div class="flex flex-col gap-6">
	<p class="text-[0.95rem] text-muted-foreground">
		{m.box_intro({ box, price: birr(draft.offer.container.price) })}
	</p>

	{#each draft.sections as { rule, choices } (rule.id)}
		{@const count = draft.counts.get(rule.id) ?? 0}
		{@const group = localized(rule, 'name')}
		<section aria-labelledby="box-rule-{rule.id}">
			<div class="flex items-baseline justify-between gap-3">
				<h3 id="box-rule-{rule.id}" class="font-semibold">{group}</h3>
				<p
					class={[
						'text-sm tabular-nums',
						count >= rule.maxQty ? 'font-semibold text-foreground' : 'text-muted-foreground'
					]}
					aria-live="polite"
				>
					{count >= rule.maxQty
						? m.box_full({ count, max: rule.maxQty })
						: m.box_count({ count, max: rule.maxQty })}
					{#if rule.minQty > 0}
						<span class="text-muted-foreground">· {m.box_at_least({ min: rule.minQty })}</span>
					{/if}
				</p>
			</div>
			<div
				class="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
				role="progressbar"
				aria-label={group}
				aria-valuemin={0}
				aria-valuemax={rule.maxQty}
				aria-valuenow={count}
			>
				<div
					class="h-full rounded-full bg-[var(--am-ink)] transition-[width]"
					style:width="{Math.min(100, (count / rule.maxQty) * 100)}%"
				></div>
			</div>

			<ul class="mt-3 flex flex-col divide-y divide-border">
				{#each choices as choice (choice.productId)}
					{@const name = localized(choice, 'name')}
					{@const qty = draft.qtyOf(choice.productId)}
					<li class="flex items-center gap-3 py-2.5">
						<div class="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
							{#if choice.image}
								<img
									src={publicFileUrl(choice.image)}
									alt=""
									width="96"
									height="96"
									loading="lazy"
									decoding="async"
									class="h-full w-full object-cover"
								/>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{name}</p>
							<p class="text-sm text-muted-foreground tabular-nums">{birr(choice.price)}</p>
						</div>
						<div
							class="flex items-center rounded-full border border-border"
							role="group"
							aria-label={name}
						>
							<button
								type="button"
								class="grid h-11 w-11 place-items-center disabled:opacity-30"
								aria-label={m.product_decrease({ name })}
								disabled={qty === 0}
								onclick={() => draft.remove(choice)}
							>
								<Minus class="h-4 w-4" aria-hidden="true" />
							</button>
							<span class="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
							<button
								type="button"
								class="grid h-11 w-11 place-items-center disabled:opacity-30"
								aria-label={m.product_increase({ name })}
								disabled={!draft.canAdd(choice)}
								onclick={() => draft.add(choice)}
							>
								<Plus class="h-4 w-4" aria-hidden="true" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
