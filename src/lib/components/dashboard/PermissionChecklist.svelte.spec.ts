import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PermissionChecklist from './PermissionChecklist.svelte';

const permissions = [
	{ id: 1, name: 'orders.view', description: 'See orders' },
	{ id: 2, name: 'orders.update', description: 'Move orders along' },
	{ id: 3, name: 'catalog.manage', description: 'Change products' }
];

/** What the surrounding form would post: the kit's checkbox must post like a native one. */
function posted(container: HTMLElement) {
	let form = container.querySelector(':scope > form') as HTMLFormElement | null;
	if (!form) {
		form = document.createElement('form');
		form.append(...container.childNodes);
		container.append(form);
	}
	return new FormData(form).getAll('permissionIds').map(String).sort();
}

describe('PermissionChecklist', () => {
	it('posts the ticked ids, and follows ticking and unticking', async () => {
		const { container } = render(PermissionChecklist, { permissions, checked: [1] });
		expect(posted(container)).toEqual(['1']);

		await page.getByRole('checkbox', { name: /Change products/ }).click();
		await page.getByRole('checkbox', { name: /See orders/ }).click();
		await expect.element(page.getByText('1 of 3 ticked.')).toBeInTheDocument();
		expect(posted(container)).toEqual(['3']);
	});

	it('posts nothing it cannot change when read-only', async () => {
		const { container } = render(PermissionChecklist, {
			permissions,
			checked: [1, 2],
			readonly: true
		});
		await expect.element(page.getByRole('checkbox', { name: /See orders/ })).toBeDisabled();
		expect(posted(container)).toEqual([]);
	});
});
