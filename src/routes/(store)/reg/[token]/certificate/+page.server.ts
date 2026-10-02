import { error } from '@sveltejs/kit';
import { certificateFor } from '$lib/server/services/school';

/** A graduate's own certificate, behind their registration link (§10 `/reg/[token]`). */
export const load = async ({ params }) => {
	const certificate = await certificateFor({ token: params.token });
	if (!certificate) error(404, 'Certificate not found');
	// Only what the certificate prints; the registration's id stays on the server.
	const { name, certificateNo, issuedAt, courseTitle, courseTitleAm, startDate, endDate } =
		certificate;
	return {
		certificate: { name, certificateNo, issuedAt, courseTitle, courseTitleAm, startDate, endDate },
		token: params.token
	};
};
