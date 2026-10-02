<script lang="ts">
	import { resolve } from '$app/paths';
	import Printer from '@lucide/svelte/icons/printer';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Certificate from '$lib/components/Certificate.svelte';

	let { data } = $props();

	const cert = $derived(data.certificate);
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		eyebrow="Certificate"
		title={cert.certificateNo}
		tabTitle="Certificate {cert.certificateNo} | Amoria"
	>
		<a
			href={resolve('/dashboard/school/students/[id]', { id: String(cert.id) })}
			class="text-sm text-muted-foreground hover:underline">Back to the registration</a
		>
	</PageHeader>
	<div>
		<Button type="button" onclick={() => window.print()}>
			<Printer class="size-4" /> Print
		</Button>
	</div>
	<div class="rounded-md border">
		<Certificate {...cert} />
	</div>
</div>
