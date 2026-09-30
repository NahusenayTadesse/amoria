import { contentCrud } from '@nahu/admin-kit/server/crud';
import { deliveryArea } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { deliveryAreaAdd, deliveryAreaEdit } from '$lib/schemas/catalog';

/** Where the shop delivers and the fee there (fixtec's delivery areas). */
const crud = contentCrud({
	table: deliveryArea,
	label: 'Delivery area',
	addSchema: deliveryAreaAdd,
	editSchema: deliveryAreaEdit,
	audit: 'delivery_area',
	transform: (values) => ({ ...values, nameAm: values.nameAm || null })
});

export const load = crud.load;
export const actions = invalidating(['settings'], crud.actions);
