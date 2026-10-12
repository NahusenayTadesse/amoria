import { childCrud } from '@nahu/admin-kit/server/childCrud';
import { renterBankAccount } from '$lib/server/db/schema';
import { currentRenter } from '$lib/server/renterArea';
import { renterAccountAdd, renterAccountEdit } from '$lib/schemas/renters';

/**
 * Where the renter's customers transfer to: the kit's `childCrud` owned by the renter, so every
 * read and write is scoped to them and the owner is stamped by the server. Amoria never holds
 * renters' money (§5.12).
 */
const crud = childCrud({
	table: renterBankAccount,
	ownerColumn: 'renterId',
	label: 'Account',
	addSchema: renterAccountAdd,
	editSchema: renterAccountEdit,
	audit: 'renter_bank_account'
});

export const load = async ({ locals }) => {
	const renter = await currentRenter(locals);
	// The renter maintains their own accounts, so they may remove one too.
	return { ...(await crud.load(renter.id)), isSuperAdmin: true };
};

export const actions = {
	add: async (event) => crud.actions.add(event, (await currentRenter(event.locals)).id),
	edit: async (event) => crud.actions.edit(event, (await currentRenter(event.locals)).id),
	delete: async (event) => crud.actions.delete(event, (await currentRenter(event.locals)).id)
};
