import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { writable } from 'svelte/store';
import TransferFields from './TransferFields.svelte';

const accounts = [
	{
		id: 1,
		bankName: 'Commercial Bank of Ethiopia',
		accountName: 'Amoria Gifts',
		accountNumber: '1000123456789'
	},
	{ id: 2, bankName: 'Telebirr', accountName: 'Amoria Gifts', accountNumber: '0911234567' }
];

function renderFields() {
	const form = writable<Record<string, unknown>>({ bankAccountId: undefined, receipt: undefined });
	render(TransferFields, { form, accounts, total: 3000 });
	return form;
}

describe('TransferFields', () => {
	it('shows the amount and every account with its number', async () => {
		renderFields();
		await expect.element(page.getByText('ETB 3,000.00').first()).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Copy account number 1000123456789' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Copy account number 0911234567' }))
			.toBeInTheDocument();
	});

	it('copying a number also picks that account, and says "Copied"', async () => {
		const form = renderFields();
		const telebirr = page.getByRole('button', { name: 'Copy account number 0911234567' });
		await telebirr.click();
		await expect.element(telebirr).toHaveTextContent('Copied');

		let chosen: unknown;
		form.subscribe((v) => (chosen = v.bankAccountId))();
		expect(chosen).toBe(2);
		await expect.element(page.getByRole('radio', { name: /Telebirr/ })).toBeChecked();
	});

	it('shows errors passed in for the account and the receipt', async () => {
		const form = writable<Record<string, unknown>>({});
		render(TransferFields, {
			form,
			accounts,
			total: 3000,
			accountError: 'Choose the account you paid into.',
			receiptError: 'Upload the transfer receipt.'
		});
		await expect.element(page.getByText('Choose the account you paid into.')).toBeInTheDocument();
		await expect.element(page.getByText('Upload the transfer receipt.')).toBeInTheDocument();
	});
});
