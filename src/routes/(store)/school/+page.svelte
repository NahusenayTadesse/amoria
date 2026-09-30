<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { reveal } from '$lib/actions/reveal';
	import { chatHref } from '$lib/chat';
	import PageHero from '$lib/components/store/PageHero.svelte';
	import CourseCard from '$lib/components/store/CourseCard.svelte';
	import ChatButtons from '$lib/components/store/ChatButtons.svelte';

	let { data } = $props();

	const steps = [
		{ title: m.school_step_1_title, body: m.school_step_1_body },
		{ title: m.school_step_2_title, body: m.school_step_2_body },
		{ title: m.school_step_3_title, body: m.school_step_3_body }
	];

	const hasChat = $derived(!!(data.contact.whatsapp.trim() || data.contact.telegram.trim()));
	const ask = $derived(chatHref(data.contact, m.chat_school()));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- an external chat link and #anchors -->
<svelte:head>
	<title>{m.school_meta_title()}</title>
	<meta name="description" content={m.school_meta_description()} />
	<meta property="og:title" content={m.school_meta_title()} />
	<meta property="og:description" content={m.school_meta_description()} />
	<meta property="og:type" content="website" />
</svelte:head>

<PageHero
	kicker={m.school_kicker()}
	before={m.school_h1_a()}
	accent={m.school_h1_b()}
	after={m.school_h1_c()}
	lede={m.school_lede()}
>
	{#snippet actions()}
		<a
			href="#courses"
			class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
		>
			{m.school_courses_heading()}
			<ArrowRight
				class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
				aria-hidden="true"
			/>
		</a>
	{/snippet}
</PageHero>

<section id="courses" class="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-8 sm:pb-28">
	<div use:reveal class="max-w-2xl">
		<p class="text-xs font-semibold tracking-[0.22em] text-[var(--am-ribbon)] uppercase">
			{m.school_courses_kicker()}
		</p>
		<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
			{m.school_courses_heading()}
		</h2>
	</div>

	{#if data.courses.length}
		<ul class="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2 lg:grid-cols-3">
			{#each data.courses as course, index (course.id)}
				<li use:reveal style="--i: {index % 3}">
					<CourseCard {course} eager={index < 3} />
				</li>
			{/each}
		</ul>
	{:else}
		<div use:reveal class="mt-10 max-w-xl rounded-[1.5rem] bg-secondary p-7 sm:p-9">
			<p class="display text-xl font-bold sm:text-2xl">{m.school_empty()}</p>
			{#if hasChat}
				<div class="mt-6 flex flex-wrap gap-3">
					<ChatButtons
						whatsapp={data.contact.whatsapp}
						telegram={data.contact.telegram}
						text={m.chat_school()}
					/>
				</div>
			{/if}
		</div>
	{/if}
</section>

<section class="relative isolate overflow-hidden bg-[var(--am-ink)] py-20 text-white sm:py-28">
	<div class="stars" aria-hidden="true"></div>
	<div class="relative mx-auto max-w-6xl px-4 sm:px-8">
		<div use:reveal class="max-w-2xl">
			<p class="text-xs font-semibold tracking-[0.22em] text-[#e6c473] uppercase">
				{m.school_steps_kicker()}
			</p>
			<h2 class="display mt-3 text-3xl leading-[1.08] font-bold sm:text-5xl">
				{m.school_steps_heading()}
			</h2>
		</div>
		<ol class="mt-12 grid gap-10 sm:mt-16 md:grid-cols-3 md:gap-8">
			{#each steps as step, index (index)}
				<li use:reveal style="--i: {index + 1}" class="step relative">
					<div
						class="step-line absolute top-[2.35rem] left-0 hidden h-px w-[calc(100%+2rem)] bg-gradient-to-r from-[#e6c473] to-[#e6c473]/0 md:block"
						aria-hidden="true"
					></div>
					<span
						class="accent relative inline-block bg-[var(--am-ink)] pr-4 text-6xl text-[#e6c473] sm:text-7xl"
					>
						{index + 1}
					</span>
					<h3 class="display mt-5 text-xl font-bold sm:text-2xl">{step.title()}</h3>
					<p class="mt-2 max-w-[34ch] text-[0.95rem] text-white/70">{step.body()}</p>
				</li>
			{/each}
		</ol>
		{#if ask}
			<div use:reveal class="mt-12">
				<a
					href={ask}
					target="_blank"
					rel="noopener noreferrer"
					class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[#e6c473] px-7 text-[0.95rem] font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
				>
					{m.school_question()}
					<ArrowRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</a>
			</div>
		{:else}
			<div use:reveal class="mt-12">
				<a
					href={resolve(localizeHref('/contact') as AppPath)}
					class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[#e6c473] px-7 text-[0.95rem] font-semibold text-[var(--am-ink)] transition-transform duration-300 hover:-translate-y-0.5"
				>
					{m.school_question()}
					<ArrowRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</a>
			</div>
		{/if}
	</div>
</section>

<style>
	.stars {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(1.5px 1.5px at 12% 22%, #e6c473, transparent),
			radial-gradient(1.5px 1.5px at 78% 14%, #fff, transparent),
			radial-gradient(2px 2px at 90% 70%, #e6c473, transparent),
			radial-gradient(1.5px 1.5px at 30% 84%, #fff, transparent),
			radial-gradient(2px 2px at 56% 46%, #e6c473, transparent),
			radial-gradient(
				40rem 26rem at 0% 0%,
				color-mix(in oklab, var(--am-ribbon) 30%, transparent),
				transparent 70%
			);
		opacity: 0.55;
		animation: tw 6s ease-in-out infinite alternate;
	}
	@keyframes tw {
		to {
			opacity: 0.85;
		}
	}
	.step-line {
		transform-origin: left;
		transition: transform 1.4s cubic-bezier(0.6, 0, 0.2, 1) 0.4s;
	}
	.step:global([data-reveal='pending']) .step-line {
		transform: scaleX(0);
	}
	@media (prefers-reduced-motion: reduce) {
		.stars {
			animation: none;
		}
	}
</style>
