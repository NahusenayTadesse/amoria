import { error } from '@sveltejs/kit';
import { certificateFor } from '$lib/server/services/school';

/** A graduate's certificate, to print for them (the student can also print it from `/reg`). */
export const load = async ({ params }) => {
	const id = Number(params.id);
	const certificate = Number.isInteger(id) && id > 0 ? await certificateFor({ id }) : null;
	if (!certificate) error(404, 'No certificate: the student has not been marked graduated');
	return { certificate };
};
