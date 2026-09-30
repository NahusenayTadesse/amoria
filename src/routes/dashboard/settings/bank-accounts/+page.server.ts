import { contentCrud } from '@nahu/admin-kit/server/crud';
import { bankAccount } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { bankAccountAdd, bankAccountEdit } from '$lib/schemas/catalog';

/** The accounts customers transfer to at checkout (fixtec's bank accounts). */
const crud = contentCrud({
	table: bankAccount,
	label: 'Account',
	addSchema: bankAccountAdd,
	editSchema: bankAccountEdit,
	uniqueField: 'accountNumber',
	audit: 'bank_account'
});

export const load = crud.load;
export const actions = invalidating(['settings'], crud.actions);
