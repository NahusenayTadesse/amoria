<script lang="ts">
	import { resolve } from '$app/paths';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PasswordGenerator from '@nahu/admin-kit/components/PasswordGenerator.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { staffAdd } from '$lib/schemas/staff';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, staffAdd);
</script>

<div class="flex flex-col gap-4">
	<PageHeader title="Add a staff member" tabTitle="Add staff | Amoria">
		<a
			href={resolve('/dashboard/admin/staff')}
			class="text-sm text-muted-foreground hover:underline">All staff</a
		>
	</PageHeader>

	<FormCard title="Their account">
		<form method="POST" use:enhance class="flex flex-col gap-4">
			<Errors allErrors={$allErrors} />
			<InputComp {form} {errors} name="name" label="Name" required />
			<InputComp
				{form}
				{errors}
				name="email"
				type="email"
				label="Email"
				description="What they sign in with."
				required
			/>
			<InputComp {form} {errors} name="phone" type="tel" label="Phone (optional)" />
			<InputComp
				{form}
				{errors}
				name="roleId"
				type="select"
				label="Role"
				items={data.roles}
				description="Decides what they may do. You can give them permissions of their own afterwards."
				required
			/>
			<InputComp
				{form}
				{errors}
				name="password"
				type="password"
				label="First password"
				description="Give it to them in person; they can keep using it, or you can reset it later."
				required
			/>
			<PasswordGenerator bind:password={$form.password} />
			<Button type="submit" class="mt-2">
				{#if $delayed}<LoadingBtn name="Adding" />{:else}<UserPlus /> Add staff member{/if}
			</Button>
		</form>
	</FormCard>
</div>
