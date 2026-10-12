<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import AdminCard from '@nahu/admin-kit/components/shell/AdminCard.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';

	let { data } = $props();

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
</script>

<div class="flex flex-col gap-4">
	<PageHeader
		title="Admin panel"
		tabTitle="Admin panel | Amoria"
		description="Who can sign in to the dashboard, and what each of them may do."
	/>
	<div class="grid gap-4 md:grid-cols-2">
		<AdminCard
			title="Staff"
			description="{plural(
				data.activeStaff,
				'active account',
				'active accounts'
			)}{data.inactiveStaff
				? `, ${data.inactiveStaff} switched off`
				: ''}. Add people, reset passwords, switch off people who leave."
			icon={UserCog}
			items={[
				{ title: 'All staff', url: '/dashboard/admin/staff', icon: UserCog },
				{ title: 'Add a staff member', url: '/dashboard/admin/staff/new', icon: UserPlus }
			]}
		/>
		<AdminCard
			title="Roles and permissions"
			description="{plural(
				data.roles,
				'role',
				'roles'
			)}. A role is a set of permissions; each staff member has one."
			icon={ShieldCheck}
			items={[{ title: 'All roles', url: '/dashboard/admin/roles', icon: ShieldCheck }]}
		/>
	</div>
</div>
