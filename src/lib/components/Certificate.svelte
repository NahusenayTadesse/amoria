<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { bothCalendars, bothCalendarsOnDay } from '$lib/localized';

	type Props = {
		name: string;
		certificateNo: string;
		issuedAt: Date;
		courseTitle: string;
		courseTitleAm: string | null;
		startDate: string;
		endDate: string | null;
	};
	let { name, certificateNo, issuedAt, courseTitle, courseTitleAm, startDate, endDate }: Props =
		$props();
</script>

<!--
	A graduate's certificate (§5.6), the same on the student's page and in the dashboard. Printing
	shows the certificate alone, on one landscape page; "Save as PDF" in the print dialog makes the
	file.
-->
<article class="certificate mx-auto aspect-[297/210] w-full max-w-4xl bg-white p-3 text-[#2b1530]">
	<div
		class="flex h-full flex-col items-center justify-between border-[3px] border-double border-[#b8862b] px-6 py-8 text-center sm:px-14 sm:py-12"
	>
		<div>
			<p class="text-xs font-semibold tracking-[0.35em] text-[#b8862b] uppercase">Amoria</p>
			<h1 class="display mt-3 text-2xl font-bold sm:text-4xl">{m.cert_heading()}</h1>
		</div>

		<div class="flex flex-col items-center gap-2 sm:gap-3">
			<p class="text-sm text-[#6b5470] sm:text-base">{m.cert_certifies()}</p>
			<p class="display border-b border-[#b8862b] px-6 pb-1 text-2xl font-bold sm:text-4xl">
				{name}
			</p>
			<p class="text-sm text-[#6b5470] sm:text-base">{m.cert_completed()}</p>
			<p class="display text-xl font-bold sm:text-2xl">
				{courseTitle}{#if courseTitleAm}<span class="block text-base font-semibold" lang="am"
						>{courseTitleAm}</span
					>{/if}
			</p>
			{#if endDate}
				<p class="text-xs text-[#6b5470] sm:text-sm">
					{m.cert_held({ from: bothCalendarsOnDay(startDate), to: bothCalendarsOnDay(endDate) })}
				</p>
			{/if}
		</div>

		<div class="flex w-full flex-wrap items-end justify-between gap-4 text-left text-xs sm:text-sm">
			<div>
				<p>{m.cert_issued({ date: bothCalendars(issuedAt) })}</p>
				<p class="font-semibold">{m.cert_number({ number: certificateNo })}</p>
			</div>
			<div class="text-right">
				<div class="mb-1 h-8 w-44 border-b border-[#2b1530]"></div>
				<p>{m.cert_school()}</p>
			</div>
		</div>
	</div>
</article>

<style>
	@media print {
		@page {
			size: A4 landscape;
			margin: 0;
		}
		:global(body *) {
			visibility: hidden;
		}
		.certificate,
		.certificate :global(*) {
			visibility: visible;
		}
		.certificate {
			position: fixed;
			inset: 0;
			max-width: none;
			height: 100vh;
			aspect-ratio: auto;
		}
	}
</style>
