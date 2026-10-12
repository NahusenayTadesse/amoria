import { error } from '@sveltejs/kit';
import { streamStoredFile } from '@nahu/admin-kit/server/serveFile';
import { currentRenter } from '$lib/server/renterArea';
import { isRenterReceipt } from '$lib/server/services/renterOrders';

/**
 * A renter's private files: the receipts their customers sent them, and their own trade licence.
 * Unlike staff's `/dashboard/files`, every name is checked against what this renter owns, so a
 * leaked name of someone else's file is a 404 here.
 */
export const GET = async ({ params, request, locals }) => {
	const renter = await currentRenter(locals);
	const name = params.name;
	const own = name === renter.tradeLicenceFile || (await isRenterReceipt(renter.id, name));
	if (!own) error(404, 'Not found');
	return streamStoredFile(name, request, 'private');
};
