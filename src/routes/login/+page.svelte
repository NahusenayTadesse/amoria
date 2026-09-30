<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { Toaster } from 'svelte-sonner';
	import { loginSchema } from '$lib/schemas/auth';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, loginSchema);

	let showPassword = $state(false);
	const EyeIcon = $derived(showPassword ? EyeOff : Eye);
</script>

<svelte:head>
	<title>Sign in | Amoria</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Toaster richColors />

<div class="flex min-h-dvh w-full items-center justify-center bg-muted/40 px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title class="text-2xl">Amoria staff sign-in</Card.Title>
			<Card.Description>Orders, products, stock and settings.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/login" use:enhance class="grid gap-4">
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autocomplete="username"
						bind:value={$form.email}
						aria-invalid={$errors.email ? 'true' : undefined}
						required
					/>
					{#if $errors.email}<span class="text-sm text-destructive">{$errors.email}</span>{/if}
				</div>

				<div class="grid gap-2">
					<Label for="password">Password</Label>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							bind:value={$form.password}
							aria-invalid={$errors.password ? 'true' : undefined}
							required
						/>
						<button
							type="button"
							class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							<EyeIcon class="size-5" />
						</button>
					</div>
					{#if $errors.password}<span class="text-sm text-destructive">{$errors.password}</span
						>{/if}
				</div>

				<Button type="submit" class="w-full">
					{#if $delayed}<LoadingBtn name="Signing in" />{:else}Sign in{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
