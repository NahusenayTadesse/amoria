<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import PowerOff from '@lucide/svelte/icons/power-off';
	import Save from '@lucide/svelte/icons/save';
	import X from '@lucide/svelte/icons/x';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PasswordGenerator from '@nahu/admin-kit/components/PasswordGenerator.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { localPhone } from '@nahu/admin-kit/phone';
	import { ethiopianDate, ethiopianDateTime } from '@nahu/admin-kit/tableCells';
	import { passwordReset, staffEdit } from '$lib/schemas/staff';
	import { quick } from '$lib/quick';
	import PermissionChecklist from '$lib/components/dashboard/PermissionChecklist.svelte';

	let { data } = $props();

	const person = $derived(data.person);
	const custom = $derived(person.customPermissionIds.length > 0);

	let editing = $state(false);

	// svelte-ignore state_referenced_locally
	const edit = createForm(data.editForm, staffEdit, {
		resetForm: false,
		onUpdated({ form }) {
			if (form.message?.type === 'success') editing = false;
		}
	});
	const editData = edit.form;
	const editDelayed = edit.delayed;
	const editAllErrors = edit.allErrors;

	// svelte-ignore state_referenced_locally
	const pw = createForm(data.passwordForm, passwordReset, { resetForm: true });
	const pwData = pw.form;
	const pwDelayed = pw.delayed;
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Staff member" title={person.name} tabTitle="{person.name} | Amoria">
		{#snippet badges()}
			<Statuses
				status={person.isActive ? 'active' : 'inactive'}
				label={person.isActive ? 'Active' : 'Switched off'}
			/>
			{#if data.isAdmin}<Statuses status="approved" label="Admin" />{/if}
			{#if data.isSelf}<Statuses status="new" label="You" />{/if}
		{/snippet}
		<a
			href={resolve('/dashboard/admin/staff')}
			class="text-sm text-muted-foreground hover:underline">All staff</a
		>
	</PageHeader>

	{#if data.isSelf}
		<Notice tone="info">
			This is your own account. Another admin has to change your role, permissions or password, so
			nobody can promote or lock themselves out by mistake.
		</Notice>
	{:else if !data.canEdit}
		<Notice tone="info">Only an admin can change an Admin’s account.</Notice>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header class="flex flex-row items-start justify-between gap-3">
				<div>
					<Card.Title>Details</Card.Title>
					<Card.Description>Changing the email signs them out everywhere.</Card.Description>
				</div>
				{#if data.canEdit}
					<Button size="sm" variant="outline" onclick={() => (editing = !editing)}>
						{#if editing}<X /> Cancel{:else}<Pencil /> Edit{/if}
					</Button>
				{/if}
			</Card.Header>
			<Card.Content>
				{#if editing}
					<form method="POST" action="?/edit" use:edit.enhance class="flex flex-col gap-4">
						<Errors allErrors={$editAllErrors} />
						<InputComp form={editData} errors={edit.errors} name="name" label="Name" required />
						<InputComp
							form={editData}
							errors={edit.errors}
							name="email"
							type="email"
							label="Email"
							required
						/>
						<InputComp
							form={editData}
							errors={edit.errors}
							name="phone"
							type="tel"
							label="Phone (optional)"
						/>
						<InputComp
							form={editData}
							errors={edit.errors}
							name="roleId"
							type="select"
							label="Role"
							items={data.roles}
							required
						/>
						<Button type="submit">
							{#if $editDelayed}<LoadingBtn name="Saving" />{:else}<Save /> Save{/if}
						</Button>
					</form>
				{:else}
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
						<dt class="text-muted-foreground">Email</dt>
						<dd>{person.email}</dd>
						<dt class="text-muted-foreground">Phone</dt>
						<dd>{localPhone(person.phone) ?? '—'}</dd>
						<dt class="text-muted-foreground">Role</dt>
						<dd>
							{#if person.roleId}
								<a
									class="text-primary hover:underline"
									href={resolve('/dashboard/admin/roles/[id]', { id: String(person.roleId) })}
									>{person.roleName}</a
								>{person.roleActive === false ? ' (switched off: confers nothing)' : ''}
							{:else}
								None
							{/if}
						</dd>
						<dt class="text-muted-foreground">Added</dt>
						<dd>{ethiopianDate(person.createdAt)}</dd>
						<dt class="text-muted-foreground">Last active</dt>
						<dd>
							{person.lastSeen ? ethiopianDateTime(new Date(person.lastSeen)) : 'Not signed in'}
						</dd>
					</dl>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Sign-in</Card.Title>
				<Card.Description>
					Switch off someone who leaves: they are signed out at once and cannot sign in, and
					everything they did stays on record. Switch them on again if they come back.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if data.canEdit}
					<form method="POST" action="?/password" use:pw.enhance class="flex flex-col gap-3">
						<InputComp
							form={pwData}
							errors={pw.errors}
							name="password"
							type="password"
							label="New password"
							description="Signs them out everywhere. Give it to them in person."
							required
						/>
						<div class="flex flex-wrap gap-2">
							<PasswordGenerator bind:password={$pwData.password} />
							<Button type="submit" variant="outline">
								{#if $pwDelayed}<LoadingBtn name="Setting" />{:else}<KeyRound /> Set password{/if}
							</Button>
						</div>
					</form>
					<div class="flex flex-wrap gap-2 border-t pt-4">
						{#if person.isActive}
							<ConfirmAction
								action="?/deactivate"
								label="Switch off"
								title="Switch off {person.name}?"
								description="They are signed out now and cannot sign in until switched on again."
								icon={PowerOff}
								variant="outline"
							/>
						{:else}
							<ConfirmAction
								action="?/activate"
								label="Switch on"
								title="Let {person.name} sign in again?"
								icon={Power}
							/>
						{/if}
						<DeleteEntity
							entity="Staff member"
							name={person.name}
							consequence="They disappear from the staff list and can never sign in again. What they did stays on record, and their email cannot be reused. To pause someone, switch them off instead."
							canDelete={data.canDelete}
						/>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">Nothing you can change here.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>What {person.name} may do</Card.Title>
			<Card.Description>
				{#if custom}
					They have <strong>their own permissions</strong>, which replace their role’s. Go back to
					the role’s to have them follow it again.
				{:else}
					They have <strong>their role’s permissions</strong>. Saving a different set gives them
					their own, which replace the role’s, for someone whose job does not fit a role.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#key person.customPermissionIds.join() + person.rolePermissionIds.join()}
				<form method="POST" action="?/permissions" use:enhance={quick} class="flex flex-col gap-4">
					<PermissionChecklist
						permissions={data.permissions}
						checked={custom ? person.customPermissionIds : person.rolePermissionIds}
						readonly={!data.canEdit}
					/>
					{#if data.canEdit}
						<div class="flex flex-wrap gap-2">
							<Button type="submit"><Save /> Save as their own permissions</Button>
							{#if custom}
								<Button type="submit" variant="outline" formaction="?/useRole">
									Go back to the role’s permissions
								</Button>
							{/if}
						</div>
					{/if}
				</form>
			{/key}
		</Card.Content>
	</Card.Root>
</div>
