import { currentRenter } from '$lib/server/renterArea';

/** Who is signed in and how their business stands, for the shell and every page under it. */
export const load = async ({ locals }) => {
	const renter = await currentRenter(locals);
	return {
		user: { id: locals.user!.id, name: locals.user!.name, email: locals.user!.email },
		renter: {
			id: renter.id,
			slug: renter.slug,
			businessName: renter.businessName,
			status: renter.status,
			reviewNote: renter.reviewNote,
			autoPublish: renter.autoPublish,
			logoFile: renter.logoFile
		}
	};
};
