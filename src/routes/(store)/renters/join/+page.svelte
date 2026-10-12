<script lang="ts">
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import FileCheck from '@lucide/svelte/icons/file-check';
	import Wallet from '@lucide/svelte/icons/wallet';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { renterJoinSchema } from '$lib/schemas/renters';

	let { data } = $props();

	// Set up once from the page's form; superforms keeps it in step after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, renterJoinSchema, {
		// The trade licence is a file: the form posts as multipart.
		dataType: 'form',
		resetForm: false
	});

	const steps = [
		{ icon: ClipboardList, title: m.join_step1_title, body: m.join_step1_body },
		{ icon: FileCheck, title: m.join_step2_title, body: m.join_step2_body },
		{ icon: BadgeCheck, title: m.join_step3_title, body: m.join_step3_body },
		{ icon: Wallet, title: m.join_step4_title, body: m.join_step4_body }
	];
</script>

<svelte:head>
	<title>{m.join_meta_title()}</title>
	<meta name="description" content={m.join_meta_description()} />
	<meta property="og:title" content={m.join_meta_title()} />
	<meta property="og:description" content={m.join_meta_description()} />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
	<div class="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
		<div>
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase">
				{m.market_join_kicker()}
			</p>
			<h1 class="display mt-3 text-4xl leading-[1.05] font-bold sm:text-5xl">
				{m.join_heading()}
			</h1>
			<p class="mt-5 max-w-[48ch] text-base text-muted-foreground sm:text-lg">{m.join_lede()}</p>

			<ol class="mt-10 flex flex-col gap-6">
				{#each steps as step, index (index)}
					<li class="flex gap-4">
						<span
							class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--am-ink)] text-white"
						>
							<step.icon class="h-5 w-5" aria-hidden="true" />
						</span>
						<span>
							<span class="block font-semibold">{step.title()}</span>
							<span class="block text-sm text-muted-foreground">{step.body()}</span>
						</span>
					</li>
				{/each}
			</ol>

			<p class="mt-10 text-sm text-muted-foreground">
				{m.join_have_account()}
				<a
					href={resolve('/login')}
					class="font-semibold text-foreground underline underline-offset-4">{m.join_sign_in()}</a
				>
			</p>
		</div>

		<form
			method="POST"
			enctype="multipart/form-data"
			use:enhance
			class="flex flex-col gap-6 rounded-[1.75rem] border border-border bg-card p-6 sm:p-8"
		>
			{#if data.signedInStaff}
				<p class="rounded-[var(--radius)] bg-secondary p-4 text-sm">{m.join_staff_note()}</p>
			{/if}

			<fieldset class="flex flex-col gap-3">
				<legend class="display mb-2 text-xl font-bold">{m.join_you()}</legend>
				<InputComp {form} {errors} name="ownerName" label={m.checkout_name()} required />
				<InputComp {form} {errors} name="email" type="email" label={m.join_email()} required />
				<InputComp
					{form}
					{errors}
					name="password"
					type="password"
					label={m.join_password()}
					description={m.join_password_hint()}
					required
				/>
			</fieldset>

			<fieldset class="flex flex-col gap-3">
				<legend class="display mb-2 text-xl font-bold">{m.join_business()}</legend>
				<InputComp {form} {errors} name="businessName" label={m.join_business_name()} required />
				<InputComp
					{form}
					{errors}
					name="phone"
					type="tel"
					label={m.checkout_phone()}
					description={m.join_phone_hint()}
					required
				/>
				<InputComp
					{form}
					{errors}
					name="area"
					label={m.join_area()}
					placeholder={m.join_area_hint()}
				/>
			</fieldset>

			<fieldset class="flex flex-col gap-3">
				<legend class="display mb-2 text-xl font-bold">{m.join_papers()}</legend>
				<p class="text-sm text-muted-foreground">{m.join_papers_hint()}</p>
				<InputComp
					{form}
					{errors}
					name="tinNumber"
					label={m.join_tin()}
					placeholder="0012345678"
					required
				/>
				<InputComp
					{form}
					{errors}
					name="tradeLicence"
					type="file"
					accept="image/*,application/pdf"
					compress={false}
					removable={false}
					label={m.join_licence()}
					placeholder={m.join_licence_hint()}
				/>
			</fieldset>

			<InputComp
				{form}
				{errors}
				name="agree"
				type="checkboxSingle"
				label={m.join_agree()}
				placeholder={m.join_agree()}
				hideLabel
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="btn-shine h-13 w-full rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] disabled:opacity-60"
			>
				{#if $delayed}<LoadingBtn name={m.join_sending()} />{:else}{m.join_submit()}{/if}
			</button>
			<p class="text-center text-xs text-muted-foreground">
				{m.join_after()}
				<a href={resolve(localizeHref('/rentals') as AppPath)} class="underline underline-offset-4"
					>{m.join_see_market()}</a
				>
			</p>
		</form>
	</div>
</div>
