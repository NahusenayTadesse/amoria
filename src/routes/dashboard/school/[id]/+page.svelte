<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Trash from '@lucide/svelte/icons/trash-2';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import { formatETB } from '@nahu/admin-kit/global';
	import { publicFileUrl } from '@nahu/admin-kit/files';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import { imageAdd } from '$lib/schemas/catalog';
	import { intakeAdd, intakeEdit } from '$lib/schemas/school';
	import ClassBuilder from '$lib/components/dashboard/ClassBuilder.svelte';
	import { courseDays } from '$lib/schoolPlan';
	import SeatsCell from './SeatsCell.svelte';

	let { data } = $props();

	const c = $derived(data.course);

	const seatsTaken = $derived(data.intakes.rows.reduce((sum, i) => sum + i.confirmed, 0));
	const awaiting = $derived(data.intakes.rows.reduce((sum, i) => sum + i.awaiting, 0));
	const needSeat = $derived(data.intakes.rows.reduce((sum, i) => sum + i.needsSeat, 0));

	const stats = $derived([
		{
			key: 'confirmed',
			label: 'Confirmed students',
			value: seatsTaken,
			format: 'count' as const,
			group: 'school',
			hint: 'Paid, across every class'
		},
		{
			key: 'awaiting',
			label: 'Awaiting payment',
			value: awaiting,
			format: 'count' as const,
			group: 'school',
			hint: 'Seats held while they pay',
			tone: awaiting ? ('warning' as const) : ('neutral' as const)
		},
		{
			key: 'needSeat',
			label: 'Paid, no seat',
			value: needSeat,
			format: 'count' as const,
			group: 'school',
			hint: 'Paid after the class filled: rebook or refund',
			tone: needSeat ? ('negative' as const) : ('neutral' as const)
		}
	]);

	/** Where a class's students are listed: the students page, filtered to it. */
	const studentsOf = (id: number) => `/dashboard/school/students?intake=${id}&queue=all`;

	const days = $derived(courseDays(c.durationDays));
	const activeShifts = $derived(data.shifts.filter((s) => s.status));

	const intakeConfig: LookupConfig = $derived({
		entity: 'Class',
		plural: 'Classes',
		fields: [
			{ name: 'startDate', label: 'First day', type: 'date' },
			{
				name: 'endDate',
				label: 'Last day',
				type: 'date',
				required: false
			},
			...(data.shifts.length
				? [
						{
							name: 'shiftId',
							label: 'Shift',
							type: 'reference' as const,
							picker: 'select' as const,
							display: 'shiftName',
							required: false
						}
					]
				: []),
			{
				name: 'scheduleText',
				label: 'Note for students',
				type: 'text',
				required: false
			},
			{ name: 'seatLimit', label: 'Max students', type: 'number' },
			{
				name: 'status',
				label: 'Registration',
				type: 'select',
				choices: [
					{ value: 'open', name: 'Open' },
					{ value: 'closed', name: 'Closed (full or paused)' },
					{ value: 'completed', name: 'Completed' },
					{ value: 'cancelled', name: 'Cancelled' }
				]
			}
		],
		extraColumns: [
			{
				id: 'students',
				header: 'Students',
				cell: ({ row }) => {
					const r = row.original as (typeof data.intakes.rows)[number];
					return renderComponent(SeatsCell, {
						href: studentsOf(r.id),
						confirmed: r.confirmed,
						awaiting: r.awaiting,
						limit: r.seatLimit
					});
				}
			}
		]
	});

	const onDelete = (done: string) => {
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			if (result.type === 'success') toast.success(done);
			else toast.error(String(result.data?.error ?? 'Only an admin can remove photos'));
			await update();
		};
	};
</script>

<div class="flex flex-col gap-4">
	<PageHeader eyebrow="Course" title={c.title} tabTitle="{c.title} | Amoria">
		{#snippet badges()}
			<Statuses
				status={c.isActive ? 'active' : 'inactive'}
				label={c.isActive ? 'On offer' : 'Not on offer'}
			/>
		{/snippet}
		<p class="text-muted-foreground">
			{formatETB(c.fee)}, {days} days per class{c.maxStudents
				? `, up to ${c.maxStudents} students`
				: ''}{c.durationText ? `, ${c.durationText}` : ''}
			{#if c.titleAm}<span lang="am">({c.titleAm})</span>{/if}
			<a href={resolve('/dashboard/school')} class="ml-2 text-sm hover:underline">All courses</a>
		</p>
	</PageHeader>

	<div class="grid gap-3 sm:grid-cols-3">
		{#each stats as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Plan classes</Card.Title>
			<Card.Description>
				Give a date range and the classes fill in: {days}-day classes one after the other, one per
				shift. Check them, change any class's size or leave it out, then create them all at once.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ClassBuilder
				durationDays={c.durationDays}
				maxStudents={c.maxStudents}
				shifts={activeShifts}
				existing={data.intakes.rows.map((r) => ({ startDate: r.startDate, shiftId: r.shiftId }))}
			/>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Classes</Card.Title>
			<Card.Description>
				Each class is one date range in one shift. Guests can register while a class is open, has
				not started and still has a place; the registration page offers the next 4 date ranges. A
				last day left empty is set {days} days from the first. Change a class's size or close it here.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<LookupSection
				config={intakeConfig}
				rows={data.intakes.rows}
				addForm={data.intakes.addForm}
				editForm={data.intakes.editForm}
				canDelete={data.isSuperAdmin}
				options={{ shiftId: data.shifts.map((s) => ({ value: s.id, name: s.name })) }}
				schemas={{ add: intakeAdd, edit: intakeEdit }}
				actions={{ add: '?/addIntake', edit: '?/editIntake', delete: '?/deleteIntake' }}
			/>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between">
			<Card.Title>Photos</Card.Title>
			<FormDialog
				title="Add a photo"
				description="Compressed in your browser before it uploads. The first photo is the one on the school page."
				action="?/addImage"
				data={data.images.addForm}
				schema={imageAdd}
				triggerLabel="Add photo"
				submitLabel="Upload"
				multipart
				resetOnSuccess
			>
				{#snippet fields({ form, errors })}
					<FileUpload {form} name="fileName" placeholder="JPG, PNG or WebP" />
					<InputComp {form} {errors} name="alt" label="What it shows (for screen readers)" />
					<InputComp {form} {errors} name="altAm" label="What it shows, in Amharic" />
					<InputComp {form} {errors} name="sortOrder" type="number" label="Order (lower first)" />
				{/snippet}
			</FormDialog>
		</Card.Header>
		<Card.Content>
			{#if data.images.rows.length === 0}
				<p class="text-sm text-muted-foreground">
					No photos yet. The school page shows a graduation-cap picture until you add one.
				</p>
			{:else}
				<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
					{#each data.images.rows as image (image.id)}
						{@const img = image as typeof image & {
							fileName: string;
							alt: string | null;
							sortOrder: number;
						}}
						<li class="group relative overflow-hidden rounded-md border">
							<img
								src={publicFileUrl(img.fileName)}
								alt={img.alt ?? ''}
								class="aspect-square w-full object-cover"
								loading="lazy"
							/>
							<p class="truncate px-2 py-1 text-xs text-muted-foreground">
								#{img.sortOrder}
								{img.alt ?? ''}
							</p>
							{#if data.isSuperAdmin}
								<form
									method="POST"
									action="?/deleteImage"
									use:enhance={() => onDelete('Photo removed')}
									class="absolute top-1 right-1"
								>
									<input type="hidden" name="id" value={img.id} />
									<Button
										type="submit"
										size="icon"
										variant="destructive"
										class="size-8"
										aria-label="Remove this photo"
									>
										<Trash class="size-4" />
									</Button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
