import { contentCrud } from '@nahu/admin-kit/server/crud';
import { schoolShift } from '$lib/server/db/schema';
import { invalidating } from '$lib/server/cache';
import { shiftAdd, shiftEdit } from '$lib/schemas/school';

/**
 * The times of day classes run in (§5.6): morning, afternoon, night, or whatever the school
 * settles on. The class builder offers the ones in use; turning one off keeps its classes.
 */
const crud = contentCrud({
	table: schoolShift,
	label: 'Shift',
	addSchema: shiftAdd,
	editSchema: shiftEdit,
	uniqueField: 'name',
	audit: 'school_shift',
	transform: (values) => {
		values.nameAm = values.nameAm || null;
		values.timeText = values.timeText || null;
		return values;
	}
});

export const load = crud.load;
export const actions = invalidating(['catalog'], crud.actions);
