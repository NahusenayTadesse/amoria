<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import Download from '@lucide/svelte/icons/download';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';

	let { data, form } = $props();

	let kind = $state('products');
	let busy = $state(false);
	const current = $derived(data.kinds.find((k) => k.kind === kind));
	// What the last action answered, given a definite shape: `form` is a union of the two actions.
	const preview = $derived(
		form?.plan
			? {
					kind: String(form.kind),
					fileName: String(form.fileName),
					ignored: form.ignored ?? [],
					plan: form.plan,
					rows: form.rows ?? []
				}
			: null
	);
	const done = $derived(form?.imported ?? null);
	const error = $derived(form?.error ? String(form.error) : null);

	const submit = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
</script>

<div class="flex max-w-5xl flex-col gap-4">
	<PageHeader
		title="Import from a spreadsheet"
		tabTitle="Import | Amoria"
		description="Bring in products, suppliers and opening stock from Excel or CSV. Every row is checked first, and one bad row stops the whole import, so nothing is half done."
	/>

	<PageSection title="1. Choose a file">
		<form
			method="POST"
			action="?/preview"
			enctype="multipart/form-data"
			use:enhance={submit}
			class="flex flex-col gap-3"
		>
			<div class="flex flex-wrap items-end gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-muted-foreground">What is in the file</span>
					<select
						name="kind"
						bind:value={kind}
						class="h-9 min-w-48 rounded-md border bg-background px-3"
					>
						{#each data.kinds as k (k.kind)}
							<option value={k.kind}>{k.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-muted-foreground">Excel (.xlsx) or CSV, up to 5 MB</span>
					<Input type="file" name="file" accept=".xlsx,.csv,.txt" class="h-9 w-72" required />
				</label>
				<Button type="submit" disabled={busy}>{busy ? 'Reading…' : 'Check the file'}</Button>
			</div>
			{#if current}
				<p class="text-sm text-muted-foreground">
					Headings it reads: {current.columns.map((c) => c.label).join(', ')}.
					<a
						class="inline-flex items-center gap-1 underline"
						href={resolve(`/dashboard/import/template/${current.kind}` as AppPath)}
						download
					>
						<Download class="size-3.5" /> Download a template
					</a>
				</p>
			{/if}
		</form>
	</PageSection>

	{#if error}<Notice tone="danger" title="Not imported">{error}</Notice>{/if}
	{#if done}
		<Notice tone="success" title="Imported">
			{#if done.kind === 'opening'}
				{done.documents} opening-stock document{done.documents === 1 ? '' : 's'} posted.
			{:else}
				{done.created} created, {done.updated} updated.
			{/if}
		</Notice>
	{/if}

	{#if preview}
		<PageSection
			title="2. Check what will happen"
			hint="{preview.fileName}: {preview.plan.creates} to create, {preview.plan
				.updates} to update{preview.plan.problems
				? `, ${preview.plan.problems} with a problem`
				: ''}."
		>
			{#if preview.ignored.length}
				<Notice tone="info">
					These columns were not recognised and are ignored: {preview.ignored.join(', ')}.
				</Notice>
			{/if}
			<div class="mt-3 max-h-[28rem] overflow-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-muted text-left text-muted-foreground">
						<tr>
							<th class="p-2 font-medium">Row</th>
							<th class="p-2 font-medium">What</th>
							<th class="p-2 font-medium">Will</th>
							<th class="p-2 font-medium">Notes</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each preview.plan.rows as row (row.row)}
							<tr class={row.errors.length ? 'bg-red-50 dark:bg-red-950/30' : ''}>
								<td class="p-2 tabular-nums">{row.row}</td>
								<td class="p-2">{row.label}</td>
								<td class="p-2">
									{row.errors.length
										? 'Nothing: fix it'
										: row.action === 'create'
											? 'Create'
											: 'Update'}
								</td>
								<td class="p-2 text-xs">
									{#each row.errors as e (e)}<div class="text-red-700 dark:text-red-400">
											{e}
										</div>{/each}
									{#each row.warnings as w (w)}<div class="text-amber-700 dark:text-amber-400">
											{w}
										</div>{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if preview.plan.problems === 0}
				<form method="POST" action="?/confirm" use:enhance={submit} class="mt-3">
					<input type="hidden" name="kind" value={preview.kind} />
					<input type="hidden" name="rows" value={JSON.stringify(preview.rows)} />
					<Button type="submit" disabled={busy}>
						{busy ? 'Importing…' : `Import ${preview.plan.rows.length} rows`}
					</Button>
				</form>
			{:else}
				<Notice tone="warning" class="mt-3">
					Fix the {preview.plan.problems} row{preview.plan.problems === 1 ? '' : 's'} marked in red in
					the file and check it again. Nothing is imported until every row is right.
				</Notice>
			{/if}
		</PageSection>
	{/if}
</div>
