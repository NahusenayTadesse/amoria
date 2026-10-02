import { contentCrud } from '@nahu/admin-kit/server/crud';
import { supplier } from '$lib/server/db/schema';
import { supplierAdd, supplierEdit } from '$lib/schemas/inventory';

/** Who Amoria buys from. A delivery names one, so every unit can be traced back to where it came from. */
const crud = contentCrud({
	table: supplier,
	label: 'Supplier',
	addSchema: supplierAdd,
	editSchema: supplierEdit,
	uniqueField: 'name',
	audit: 'supplier',
	transform: (values) => ({
		...values,
		email: values.email || null,
		address: values.address || null,
		tin: values.tin || null,
		leadTimeDays: values.leadTimeDays ?? null
	})
});

export const load = crud.load;
export const actions = crud.actions;
