<script lang="ts">
	import { resolve } from '$app/paths';
	import FileText from '@lucide/svelte/icons/file-text';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import type { AppPath } from '$lib/paths';
	import { renterProfileSchema } from '$lib/schemas/renters';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, renterProfileSchema, {
		resetForm: false
	});
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Shop profile"
		tabTitle="Shop profile | Amoria renters"
		description="Your page on Amoria. A clear logo, a cover photo and a few honest lines about your business are what make customers pick you."
	>
		{#snippet actions()}
			{#if data.renter.status === 'approved'}
				<Button
					href={resolve(`/renters/${data.renter.slug}` as AppPath)}
					target="_blank"
					variant="outline">See my page</Button
				>
			{/if}
		{/snippet}
	</PageHeader>

	<form method="POST" enctype="multipart/form-data" use:enhance class="grid max-w-3xl gap-4">
		<Errors allErrors={$allErrors} />

		<FormCard title="Your business" description="As customers will see it.">
			<div class="grid gap-4 sm:grid-cols-2">
				<InputComp {form} {errors} name="businessName" label="Business name" />
				<InputComp {form} {errors} name="businessNameAm" label="Business name, in Amharic" />
				<InputComp
					{form}
					{errors}
					name="tagline"
					label="One line about you"
					description="e.g. Sound and light for weddings since 2015"
				/>
				<InputComp {form} {errors} name="taglineAm" label="One line, in Amharic" />
				<InputComp
					{form}
					{errors}
					name="foundedYear"
					type="number"
					label="Year you started"
					description="Shown as years of experience."
				/>
				<InputComp
					{form}
					{errors}
					name="area"
					label="Where you are"
					description="e.g. Bole, Addis Ababa"
				/>
				<div class="sm:col-span-2">
					<InputComp
						{form}
						{errors}
						name="serviceAreas"
						label="Where you work"
						description="Towns or areas you deliver to or serve, separated by commas."
					/>
				</div>
				<InputComp
					{form}
					{errors}
					name="offersDelivery"
					type="checkboxSingle"
					label="We deliver"
					placeholder="We deliver"
					hideLabel
				/>
				<InputComp
					{form}
					{errors}
					name="offersSetup"
					type="checkboxSingle"
					label="We set up on site"
					placeholder="We set up on site"
					hideLabel
				/>
			</div>
		</FormCard>

		<FormCard
			title="Logo and cover"
			description="Square logo; a wide cover photo of your best work."
		>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-2">
					<span class="text-sm font-medium">Logo</span>
					<FileUpload
						{form}
						name="logoFile"
						accept="image/*"
						image={data.files.logoFile ? publicFileUrl(data.files.logoFile) : undefined}
						placeholder="Your logo"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<span class="text-sm font-medium">Cover photo</span>
					<FileUpload
						{form}
						name="coverFile"
						accept="image/*"
						image={data.files.coverFile ? publicFileUrl(data.files.coverFile) : undefined}
						placeholder="A wide photo of your work"
					/>
				</div>
			</div>
		</FormCard>

		<FormCard
			title="Your story"
			description="What you rent, who you work with, what you are proud of."
		>
			<div class="grid gap-4">
				<InputComp {form} {errors} name="about" type="textarea" rows={6} label="About us" />
				<InputComp
					{form}
					{errors}
					name="aboutAm"
					type="textarea"
					rows={6}
					label="About us, in Amharic"
				/>
				<InputComp
					{form}
					{errors}
					name="policies"
					type="textarea"
					rows={4}
					label="Your terms"
					description="Deposits, cancellations, damage, pick-up and return times. Shown on every rental of yours."
				/>
				<InputComp
					{form}
					{errors}
					name="policiesAm"
					type="textarea"
					rows={4}
					label="Your terms, in Amharic"
				/>
			</div>
		</FormCard>

		<FormCard
			title="How customers reach you"
			description="Shown on your page and on their booking."
		>
			<div class="grid gap-4 sm:grid-cols-3">
				<InputComp {form} {errors} name="phone" type="tel" label="Phone" />
				<InputComp {form} {errors} name="whatsapp" type="tel" label="WhatsApp (if different)" />
				<InputComp {form} {errors} name="telegram" label="Telegram username" />
			</div>
		</FormCard>

		<div>
			<Button type="submit" size="lg">
				{#if $delayed}<LoadingBtn name="Saving" />{:else}Save profile{/if}
			</Button>
		</div>
	</form>

	<FormCard title="Papers Amoria checked" description="Private: customers never see these.">
		<dl class="grid gap-3 text-sm sm:grid-cols-2">
			<div>
				<dt class="text-muted-foreground">TIN</dt>
				<dd class="font-medium">{data.papers.tinNumber}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Trade licence</dt>
				<dd>
					<a
						href={resolve(`/renter/files/${data.papers.tradeLicenceFile}` as AppPath)}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
					>
						<FileText class="size-4" /> View
					</a>
				</dd>
			</div>
		</dl>
		<p class="mt-3 text-sm text-muted-foreground">To change them after approval, contact Amoria.</p>
	</FormCard>
</div>
