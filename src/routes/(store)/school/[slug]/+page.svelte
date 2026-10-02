<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Clock from '@lucide/svelte/icons/clock';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { birr, bothCalendarsOnDay, localized } from '$lib/localized';
	import { reveal } from '$lib/actions/reveal';
	import { chatHref } from '$lib/chat';
	import ImageGallery from '$lib/components/store/ImageGallery.svelte';
	import SeatsLeft from '$lib/components/store/SeatsLeft.svelte';
	import { courseDays, upcomingRanges } from '$lib/schoolPlan';

	let { data } = $props();

	const course = $derived(data.course);
	const title = $derived(localized(course, 'title'));
	const summary = $derived(localized(course, 'summary'));
	const curriculum = $derived(
		getLocale() === 'am' && course.curriculumAm.length ? course.curriculumAm : course.curriculum
	);
	const images = $derived(
		course.images.map((image) => ({
			fileName: image.fileName,
			alt: (getLocale() === 'am' && image.altAm) || image.alt || title
		}))
	);
	const open = $derived(course.intakes.filter((intake) => intake.seatsLeft > 0));
	/** Every upcoming date range, its shifts together. */
	const ranges = $derived(upcomingRanges(course.intakes, Infinity));
	const days = $derived(courseDays(course.durationDays));
	const shiftLabel = (c: (typeof course.intakes)[number]) =>
		c.shiftName
			? localized({ name: c.shiftName, nameAm: c.shiftNameAm }, 'name')
			: m.school_class();
	const ask = $derived(chatHref(data.contact, m.chat_school()));
	const path = (to: string) => resolve(localizeHref(to) as AppPath);

	const description = $derived(m.school_course_meta_description({ title, fee: birr(course.fee) }));

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'Course',
					name: title,
					description: summary || description,
					provider: { '@type': 'Organization', name: 'Amoria' },
					offers: { '@type': 'Offer', price: course.fee, priceCurrency: 'ETB' }
				},
				{
					'@type': 'BreadcrumbList',
					itemListElement: [
						{ '@type': 'ListItem', position: 1, name: 'Amoria', item: page.url.origin },
						{
							'@type': 'ListItem',
							position: 2,
							name: m.school_kicker(),
							item: `${page.url.origin}${path('/school')}`
						},
						{ '@type': 'ListItem', position: 3, name: title }
					]
				}
			]
		}).replace(/</g, '\\u003c')
	);
	const ldTag = $derived(`<script type="application/ld+json">${jsonLd}<${'/'}script>`);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- an external chat link and #anchors -->
<svelte:head>
	<title>{m.school_course_meta_title({ title })}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={m.school_course_meta_title({ title })} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	{#if course.images[0]}
		<meta
			property="og:image"
			content={`${page.url.origin}${publicFileUrl(course.images[0].fileName)}`}
		/>
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ldTag}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pt-12 sm:pb-28">
	<a
		href={path('/school')}
		class="rise group inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
		style="--i: 0"
	>
		<ArrowLeft
			class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
			aria-hidden="true"
		/>
		{m.school_back()}
	</a>

	<div class="mt-6 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
		<div class="rise" style="--i: 1">
			<ImageGallery {images}>
				{#snippet fallback()}
					<div class="course-art absolute inset-0 grid place-items-center" aria-hidden="true">
						<GraduationCap class="h-24 w-24 text-white/90" />
					</div>
				{/snippet}
			</ImageGallery>
		</div>

		<div class="flex flex-col">
			<p
				class="rise text-xs font-semibold tracking-[0.22em] text-[var(--am-foil)] uppercase"
				style="--i: 1"
			>
				{m.school_kicker()}
			</p>
			<h1 class="display mt-3 text-4xl leading-[1.05] font-bold sm:text-5xl">
				<span class="line"><span class="line-in" style="--i: 2">{title}</span></span>
			</h1>
			{#if summary}
				<p class="rise mt-5 max-w-[52ch] text-base text-muted-foreground sm:text-lg" style="--i: 3">
					{summary}
				</p>
			{/if}

			<dl class="rise mt-7 flex flex-wrap gap-x-10 gap-y-4" style="--i: 4">
				<div>
					<dt class="text-xs text-muted-foreground">{m.school_fee()}</dt>
					<dd class="display text-3xl font-bold tabular-nums">{birr(course.fee)}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted-foreground">{m.school_duration()}</dt>
					<dd class="mt-1 flex items-center gap-2 text-base font-semibold">
						<Clock class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
						{course.durationText || m.school_days({ days })}
					</dd>
				</div>
			</dl>

			<div class="rise mt-8 flex flex-wrap items-center gap-3" style="--i: 5">
				{#if open[0]}
					<a
						href={path(`/school/${course.slug}/register`)}
						class="btn-shine group inline-flex h-13 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-7 text-[0.95rem] font-semibold text-white shadow-[0_14px_34px_-14px_var(--am-ribbon)] transition-transform duration-300 hover:-translate-y-0.5"
					>
						{m.school_register()}
						<ArrowRight
							class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
							aria-hidden="true"
						/>
					</a>
				{/if}
				{#if ask}
					<a
						href={ask}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex h-13 items-center rounded-full border border-foreground/30 px-7 text-[0.95rem] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground"
					>
						{m.school_question()}
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Intakes -->
	<section id="intakes" class="mt-20 scroll-mt-24 sm:mt-28">
		<h2 use:reveal class="display text-3xl font-bold sm:text-4xl">{m.school_intakes()}</h2>
		{#if ranges.length}
			<ul class="mt-8 grid gap-4 md:grid-cols-2">
				{#each ranges as range, index (range.startDate)}
					<li
						use:reveal
						style="--i: {index % 2}"
						class="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-card p-6"
					>
						<div class="min-w-0">
							<p
								class="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--am-foil)] uppercase"
							>
								<CalendarDays class="h-4 w-4" aria-hidden="true" />
								{m.school_starts()}
							</p>
							<p class="display mt-1 text-xl font-bold">{bothCalendarsOnDay(range.startDate)}</p>
							{#if range.endDate}
								<p class="mt-1 text-sm text-muted-foreground">
									{m.school_ends()}: {bothCalendarsOnDay(range.endDate)}
								</p>
							{/if}
						</div>
						<ul class="flex flex-col gap-2 border-t border-border pt-4">
							{#each range.classes as c (c.id)}
								<li class="flex flex-wrap items-center justify-between gap-3">
									<span class="text-sm">
										<span class="font-semibold">{shiftLabel(c)}</span>
										{#if c.shiftTime}<span class="text-muted-foreground">, {c.shiftTime}</span>{/if}
									</span>
									<span class="flex items-center gap-3">
										<SeatsLeft count={c.seatsLeft} />
										{#if c.seatsLeft > 0}
											<a
												href={path(`/school/${course.slug}/register?class=${c.id}`)}
												class="group inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background transition-transform duration-300 hover:-translate-y-0.5"
												aria-label="{m.school_register()}: {shiftLabel(c)}, {bothCalendarsOnDay(
													range.startDate
												)}"
											>
												{m.school_register()}
												<ArrowRight
													class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
													aria-hidden="true"
												/>
											</a>
										{/if}
									</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{:else}
			<p use:reveal class="mt-6 max-w-xl rounded-[1.5rem] bg-secondary p-6 text-muted-foreground">
				{m.school_intakes_none()}
			</p>
		{/if}
	</section>

	<!-- Curriculum -->
	{#if curriculum.length}
		<section class="mt-20 sm:mt-28">
			<h2 use:reveal class="display text-3xl font-bold sm:text-4xl">{m.school_curriculum()}</h2>
			<ol class="timeline mt-10 max-w-3xl">
				{#each curriculum as item, index (index)}
					<li
						use:reveal
						style="--i: {Math.min(index, 4)}"
						class="relative flex gap-5 pb-8 last:pb-0"
					>
						<span
							class="dot relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--am-ribbon)] text-sm font-bold text-white"
						>
							{index + 1}
						</span>
						<p class="pt-1 text-base sm:text-lg">{item}</p>
					</li>
				{/each}
			</ol>
		</section>
	{/if}
</div>

<style>
	.course-art {
		background:
			radial-gradient(circle at 25% 30%, #e0568f, transparent 55%),
			radial-gradient(circle at 78% 72%, #d4a23a, transparent 55%), #4f2153;
	}
	.timeline > li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 1.125rem;
		top: 2.25rem;
		bottom: 0;
		width: 2px;
		background: linear-gradient(
			var(--am-ribbon),
			color-mix(in oklab, var(--am-ribbon) 15%, transparent)
		);
		transform-origin: top;
		transition: transform 1s cubic-bezier(0.6, 0, 0.2, 1) 0.3s;
	}
	.timeline > li:global([data-reveal='pending'])::before {
		transform: scaleY(0);
	}
	.dot {
		transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.timeline > li:hover .dot {
		transform: scale(1.15);
	}
</style>
