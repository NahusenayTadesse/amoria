<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { Toaster } from 'svelte-sonner';
	import { setupSchema } from '$lib/schemas/auth';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, setupSchema);
</script>

<svelte:head>
	<title>Set up Amoria</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Toaster richColors />

<div class="flex min-h-dvh w-full items-center justify-center bg-muted/40 px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title class="text-2xl">Create the first admin</Card.Title>
			<Card.Description>
				This page works once. After this, staff accounts are created from the dashboard.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" use:enhance class="grid gap-4">
				<InputComp {form} {errors} name="name" label="Your name" required />
				<InputComp {form} {errors} name="email" type="email" label="Email" required />
				<InputComp
					{form}
					{errors}
					name="password"
					type="password"
					label="Password (at least 10 characters)"
					required
				/>
				<Button type="submit" class="w-full">
					{#if $delayed}<LoadingBtn name="Creating" />{:else}Create admin{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
