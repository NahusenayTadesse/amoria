<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Save from '@lucide/svelte/icons/save';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { roleEdit } from '$lib/schemas/staff';
	import { quick } from '$lib/quick';
	import PermissionChecklist from '$lib/components/dashboard/PermissionChecklist.svelte';

	let { data } = $props();

	const role = $derived(data.role);
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		eyebrow="Role"
		title={role.name}
		tabTitle="{role.name} | Amoria"
		description={role.description ?? undefined}
	>
		{#snippet badges()}
			<Statuses
				status={role.isActive ? 'active' : 'inactive'}
				label={role.isActive ? 'In use' : 'Switched off'}
			/>
		{/snippet}
		{#snippet actions()}
			{#if !role.isAdmin}
				<FormDialog
					title="Edit this role"
					description="Switching a role off takes every permission away from the people who have it, until it is switched on again."
					action="?/edit"
					data={data.editForm}
					schema={roleEdit}
					triggerLabel="Edit"
					submitLabel="Save"
				>
					{#snippet fields({ form, errors })}
						<InputComp {form} {errors} name="name" label="Name" required />
						<InputComp {form} {errors} name="description" type="textarea" label="What it is for" />
						<InputComp
							{form}
							{errors}
							name="isActive"
							type="checkboxSingle"
							label="Status"
							placeholder="In use"
						/>
					{/snippet}
				</FormDialog>
				<DeleteEntity
					entity="Role"
					name={role.name}
					consequence="Its permissions go with it."
					canDelete={data.canDelete}
				/>
			{/if}
		{/snippet}
		<a
			href={resolve('/dashboard/admin/roles')}
			class="text-sm text-muted-foreground hover:underline">All roles</a
		>
	</PageHeader>

	{#if role.isAdmin}
		<Notice tone="info">
			The Admin role always has every permission, including ones added later, so it cannot be
			changed, switched off or deleted. There must always be at least one active Admin.
		</Notice>
	{:else if !role.isActive}
		<Notice tone="warning">
			This role is switched off: the people who have it can sign in but may do nothing.
		</Notice>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Permissions</Card.Title>
			<Card.Description>
				What everyone with this role may do. A change applies to them straight away, except to
				anyone who has permissions of their own.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#key role.permissionIds.join()}
				<form method="POST" action="?/permissions" use:enhance={quick} class="flex flex-col gap-4">
					<PermissionChecklist
						permissions={data.permissions}
						checked={role.isAdmin ? data.permissions.map((p) => p.id) : role.permissionIds}
						readonly={role.isAdmin}
					/>
					{#if !role.isAdmin}
						<div><Button type="submit"><Save /> Save permissions</Button></div>
					{/if}
				</form>
			{/key}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Staff with this role</Card.Title>
			{#if !data.canDelete && !role.isAdmin && role.members.length}
				<Card.Description>A role can be deleted only once nobody has it.</Card.Description>
			{/if}
		</Card.Header>
		<Card.Content>
			{#if role.members.length}
				<ul class="flex flex-col divide-y text-sm">
					{#each role.members as member (member.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 py-2">
							<span>
								<a
									class="font-medium text-primary hover:underline"
									href={resolve('/dashboard/admin/staff/[id]', { id: member.id })}>{member.name}</a
								>
								<span class="block text-muted-foreground">{member.email}</span>
							</span>
							{#if !member.isActive}<Statuses status="inactive" label="Switched off" />{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">Nobody has this role yet.</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
