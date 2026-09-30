<script lang="ts">
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Check from '@lucide/svelte/icons/check';
	import Mail from '@lucide/svelte/icons/mail';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Phone from '@lucide/svelte/icons/phone';
	import Plus from '@lucide/svelte/icons/plus';
	import Send from '@lucide/svelte/icons/send';
	import { m } from '$lib/paraglide/messages.js';
	import { reveal } from '$lib/actions/reveal';
	import { spotlight } from '$lib/actions/spotlight';
	import { telHref, telegramHref, whatsappHref } from '$lib/chat';
	import PageHero from '$lib/components/store/PageHero.svelte';

	let { data } = $props();

	const c = $derived(data.contact);
	const text = $derived(m.chat_general());

	type Way = {
		icon: typeof Phone;
		title: string;
		hint: string;
		detail?: string;
		href: string;
		wide?: boolean;
	};

	// Only the ways that are set up in Settings; a card with nowhere to go is not shown.
	const ways = $derived.by(() => {
		const list: Way[] = [];
		const wa = whatsappHref(c.whatsapp, text);
		const tg = telegramHref(c.telegram, text);
		const tel = telHref(c.phone);
		if (wa)
			list.push({
				icon: MessageCircle,
				title: m.home_contact_whatsapp(),
				hint: m.contact_whatsapp_hint(),
				href: wa
			});
		if (tg)
			list.push({
				icon: Send,
				title: m.home_contact_telegram(),
				hint: m.contact_telegram_hint(),
				href: tg
			});
		if (tel)
			list.push({
				icon: Phone,
				title: m.home_contact_call(),
				hint: m.contact_call_hint(),
				detail: c.phone,
				href: tel
			});
		if (c.email.trim())
			list.push({
				icon: Mail,
				title: m.contact_email(),
				hint: m.contact_email_hint(),
				detail: c.email,
				href: `mailto:${c.email.trim()}`
			});
		return list;
	});

	const prep = [m.contact_prep_1, m.contact_prep_2, m.contact_prep_3, m.contact_prep_4];
	const faqs = [
		{ q: m.contact_faq_1_q, a: m.contact_faq_1_a },
		{ q: m.contact_faq_2_q, a: m.contact_faq_2_a },
		{ q: m.contact_faq_3_q, a: m.contact_faq_3_a },
		{ q: m.contact_faq_4_q, a: m.contact_faq_4_a }
	];

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'ContactPage',
			name: m.contact_meta_title(),
			about: {
				'@type': 'LocalBusiness',
				name: 'Amoria',
				telephone: c.phone || undefined,
				email: c.email || undefined,
				address: {
					'@type': 'PostalAddress',
					streetAddress: c.address,
					addressLocality: 'Addis Ababa',
					addressCountry: 'ET'
				}
			}
		}).replace(/</g, '\\u003c')
	);
	const ldTag = $derived(`<script type="application/ld+json">${jsonLd}<${'/'}script>`);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- chat, phone, mail and map links are not app routes -->
<svelte:head>
	<title>{m.contact_meta_title()}</title>
	<meta name="description" content={m.contact_meta_description()} />
	<meta property="og:title" content={m.contact_meta_title()} />
	<meta property="og:description" content={m.contact_meta_description()} />
	<meta property="og:type" content="website" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ldTag}
</svelte:head>

<PageHero
	kicker={m.contact_kicker()}
	before={m.contact_h1_a()}
	accent={m.contact_h1_b()}
	after={m.contact_h1_c()}
	lede={m.contact_lede()}
/>

<!-- Ways to reach us -->
<section id="contact" class="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-8 sm:pb-28">
	{#if ways.length}
		<ul class="grid gap-4 sm:grid-cols-2">
			{#each ways as way, index (way.title)}
				{@const Icon = way.icon}
				<li use:reveal style="--i: {index}">
					<a
						use:spotlight
						href={way.href}
						target={way.href.startsWith('https://') ? '_blank' : undefined}
						rel={way.href.startsWith('https://') ? 'noopener noreferrer' : undefined}
						class="spotlight group flex h-full items-center gap-5 rounded-[1.5rem] border border-border bg-card p-6 transition-[border-color,transform,box-shadow] duration-500 hover:-translate-y-1 hover:border-[var(--am-ribbon)]/40 hover:shadow-[0_24px_50px_-28px_var(--am-ribbon)] sm:p-8"
					>
						<span
							class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-[var(--am-ribbon)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-6deg] group-hover:bg-[var(--am-ribbon)] group-hover:text-white"
						>
							<Icon class="h-6 w-6" aria-hidden="true" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="display block text-xl font-bold sm:text-2xl">{way.title}</span>
							<span class="block text-sm text-muted-foreground">{way.hint}</span>
							{#if way.detail}
								<span class="mt-1 block truncate text-sm font-semibold tabular-nums"
									>{way.detail}</span
								>
							{/if}
						</span>
						<ArrowUpRight
							class="h-5 w-5 shrink-0 text-foreground/40 transition-all duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[var(--am-ribbon)]"
							aria-hidden="true"
						/>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p use:reveal class="rounded-[1.5rem] bg-secondary p-6 text-muted-foreground sm:p-8">
			{m.home_contact_soon()}
		</p>
	{/if}

	<!-- Visit -->
	<div
		use:reveal
		class="visit relative mt-4 overflow-hidden rounded-[1.75rem] bg-[var(--am-ink)] p-7 text-white sm:p-10"
	>
		<div class="visit-glow" aria-hidden="true"></div>
		<div class="relative flex flex-wrap items-center justify-between gap-6">
			<div class="flex items-start gap-4">
				<span
					class="pin grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e6c473] text-[var(--am-ink)]"
				>
					<MapPin class="h-6 w-6" aria-hidden="true" />
				</span>
				<div>
					<p class="text-xs font-semibold tracking-[0.22em] text-[#e6c473] uppercase">
						{m.home_contact_visit()}
					</p>
					<p class="display mt-1 text-2xl font-bold sm:text-3xl">{c.address}</p>
					<p class="mt-1 text-sm text-white/70">{m.contact_visit_hint()}</p>
				</div>
			</div>
			{#if c.mapUrl}
				<a
					href={c.mapUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="btn-shine group inline-flex h-12 items-center gap-2 rounded-full bg-[#e6c473] px-6 text-sm font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
				>
					{m.home_contact_map()}
					<ArrowUpRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
						aria-hidden="true"
					/>
				</a>
			{/if}
		</div>
	</div>
</section>

<!-- Planning décor + FAQ -->
<section class="bg-card py-20 sm:py-28">
	<div class="mx-auto grid max-w-6xl gap-14 px-4 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
		<div use:reveal>
			<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
				{m.contact_prep_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-4xl">
				{m.contact_prep_heading()}
			</h2>
			<ul class="mt-8 space-y-4">
				{#each prep as item, index (index)}
					<li use:reveal style="--i: {index + 1}" class="flex items-start gap-3.5">
						<span
							class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--am-ribbon)] text-white"
						>
							<Check class="h-3.5 w-3.5" aria-hidden="true" />
						</span>
						<span class="text-base">{item()}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div>
			<div use:reveal>
				<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
					{m.contact_faq_kicker()}
				</p>
				<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-4xl">
					{m.contact_faq_heading()}
				</h2>
			</div>
			<div class="mt-8 border-t border-border">
				{#each faqs as faq, index (index)}
					<details use:reveal style="--i: {index}" class="faq group border-b border-border">
						<summary
							class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold sm:text-lg [&::-webkit-details-marker]:hidden"
						>
							{faq.q()}
							<span
								class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border transition-all duration-300 group-open:rotate-45 group-open:border-[var(--am-ribbon)] group-open:bg-[var(--am-ribbon)] group-open:text-white"
							>
								<Plus class="h-4 w-4" aria-hidden="true" />
							</span>
						</summary>
						<p class="faq-body max-w-[58ch] pb-5 text-muted-foreground">{faq.a()}</p>
					</details>
				{/each}
			</div>
		</div>
	</div>
</section>

<style>
	.visit-glow {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				28rem 20rem at 100% 0%,
				color-mix(in oklab, var(--am-ribbon) 45%, transparent),
				transparent 65%
			),
			radial-gradient(
				22rem 16rem at 0% 100%,
				color-mix(in oklab, #e6c473 16%, transparent),
				transparent 65%
			);
	}
	.pin {
		animation: pin-bob 3.4s ease-in-out infinite;
	}
	@keyframes pin-bob {
		50% {
			transform: translateY(-5px);
		}
	}
	.faq[open] .faq-body {
		animation: faq-in 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes faq-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pin,
		.faq[open] .faq-body {
			animation: none;
		}
	}
</style>
