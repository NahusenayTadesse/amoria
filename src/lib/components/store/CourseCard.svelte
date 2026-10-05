<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Clock from '@lucide/svelte/icons/clock';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import { resolve } from '$app/paths';
	import type { AppPath } from '$lib/paths';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { birr, bothCalendarsOnDay, localized } from '$lib/localized';
	import type { SchoolCourse } from '$lib/server/services/school';
	import SeatsLeft from './SeatsLeft.svelte';

	type Props = { course: SchoolCourse; eager?: boolean };
	let { course, eager = false }: Props = $props();

	const title = $derived(localized(course, 'title'));
	const summary = $derived(localized(course, 'summary'));
	const path = (to: string) => resolve(localizeHref(to) as AppPath);
</script>

<article
	class="course group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_32px_60px_-34px_var(--am-ink)]"
>
	<div class="relative aspect-[16/10] overflow-hidden bg-secondary">
		{#if course.image}
			<img
				src={publicFileUrl(course.image)}
				alt={course.imageAlt ?? title}
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="640"
				height="400"
				class="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
			/>
		{:else}
			<div class="course-art absolute inset-0 grid place-items-center" aria-hidden="true">
				<GraduationCap class="art-icon h-16 w-16 text-white/90" />
			</div>
		{/if}
		{#if course.durationText}
			<span
				class="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--am-ink)]"
			>
				<Clock class="h-3.5 w-3.5" aria-hidden="true" />
				{course.durationText}
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col p-6">
		<h3 class="display text-2xl leading-tight font-bold">
			<!-- The whole card is the link; the register button sits above it. -->
			<a
				href={path(`/school/${course.slug}`)}
				class="after:absolute after:inset-0 after:content-['']"
			>
				{title}
			</a>
		</h3>
		{#if summary}
			<p class="mt-2 line-clamp-3 text-sm text-muted-foreground">{summary}</p>
		{/if}

		<div class="mt-auto flex flex-col gap-4 pt-6">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p class="text-xs text-muted-foreground">{m.school_fee()}</p>
					<p class="display text-xl font-bold tabular-nums">{birr(course.fee)}</p>
				</div>
				{#if course.next}
					<div class="flex flex-col items-end gap-1.5 text-right">
						<span class="text-xs text-muted-foreground">
							{m.school_next_intake()}: {bothCalendarsOnDay(course.next.startDate)}
						</span>
						<SeatsLeft count={course.next.seatsLeft} />
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">{m.school_no_date()}</p>
				{/if}
			</div>

			<div class="relative z-10 flex flex-wrap gap-2">
				{#if course.next}
					<a
						href={path(`/school/${course.slug}/register?class=${course.next.id}`)}
						class="btn-shine group/btn inline-flex h-11 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
					>
						{m.school_register()}
						<ArrowRight
							class="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
							aria-hidden="true"
						/>
					</a>
				{/if}
				<span
					class="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-[var(--am-ribbon)]"
				>
					{m.school_view_course()}
					<ArrowRight
						class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5"
						aria-hidden="true"
					/>
				</span>
			</div>
		</div>
	</div>
</article>

<style>
	.course-art {
		background:
			radial-gradient(circle at 25% 30%, #2f8a5e, transparent 55%),
			radial-gradient(circle at 78% 72%, #d4a23a, transparent 55%), #1d5b3d;
		transition: transform 0.9s ease;
	}
	.course:hover .course-art {
		transform: scale(1.08);
	}
	:global(.art-icon) {
		animation: art-float 5s ease-in-out infinite;
	}
	@keyframes art-float {
		50% {
			transform: translateY(-6px) rotate(-4deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.art-icon) {
			animation: none;
		}
	}
</style>
