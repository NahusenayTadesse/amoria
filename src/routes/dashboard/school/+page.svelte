<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupField } from '@nahu/admin-kit/components/lookup/types';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { courseAdd, courseEdit } from '$lib/schemas/school';
	import { extraColumns } from './columns';

	let { data } = $props();

	const fields: LookupField[] = [
		{ name: 'title', label: 'Course name', type: 'text' },
		{ name: 'fee', label: 'Fee', type: 'money' },
		{
			name: 'durationText',
			label: 'How long it runs (e.g. 6 weeks, Saturdays)',
			type: 'text',
			required: false
		},
		{
			name: 'titleAm',
			label: 'Course name (Amharic)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'slug',
			label: 'Link name (left empty: made from the name)',
			type: 'text',
			required: false,
			inTable: false
		},
		{
			name: 'summary',
			label: 'Summary',
			type: 'textarea',
			rows: 3,
			required: false,
			inTable: false
		},
		{
			name: 'summaryAm',
			label: 'Summary (Amharic)',
			type: 'textarea',
			rows: 3,
			required: false,
			inTable: false
		},
		{
			name: 'curriculum',
			label: 'What students learn (one item per line)',
			type: 'textarea',
			rows: 5,
			required: false,
			inTable: false
		},
		{
			name: 'curriculumAm',
			label: 'What students learn, in Amharic (one item per line)',
			type: 'textarea',
			rows: 5,
			required: false,
			inTable: false
		},
		{
			name: 'sortOrder',
			label: 'Order on the school page (lower first)',
			type: 'number',
			required: false,
			inTable: false
		},
		{ name: 'status', label: 'On offer', type: 'boolean' }
	];
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Courses"
		tabTitle="Courses | Amoria"
		description="The décor school's courses. Dates and seats belong to intakes and photos to the course itself: open a course to manage them. Students are under &quot;Students&quot;."
	/>
	<LookupPage
		{data}
		schemas={{ add: courseAdd, edit: courseEdit }}
		config={{ entity: 'Course', plural: 'Courses', fields, extraColumns }}
	/>
</div>
