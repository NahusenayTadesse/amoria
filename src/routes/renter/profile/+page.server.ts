import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { removeFileField } from '@nahu/admin-kit/files';
import { saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { currentRenter, renterActor } from '$lib/server/renterArea';
import { updateProfile } from '$lib/server/services/renters';
import { formAttempt } from '$lib/server/attempt';
import { renterProfileSchema } from '$lib/schemas/renters';
import { localPhone } from '@nahu/admin-kit/phone';

/**
 * The renter's shop profile: what makes their page on Amoria theirs — logo, cover, story, where
 * they work, what they offer, their terms and how to reach them.
 */
export const load = async ({ locals }) => {
	const renter = await currentRenter(locals);
	const form = await superValidate(
		{
			businessName: renter.businessName,
			businessNameAm: renter.businessNameAm ?? '',
			tagline: renter.tagline ?? '',
			taglineAm: renter.taglineAm ?? '',
			about: renter.about ?? '',
			aboutAm: renter.aboutAm ?? '',
			policies: renter.policies ?? '',
			policiesAm: renter.policiesAm ?? '',
			area: renter.area ?? '',
			serviceAreas: renter.serviceAreas ?? '',
			foundedYear: renter.foundedYear ?? undefined,
			offersDelivery: renter.offersDelivery,
			offersSetup: renter.offersSetup,
			phone: localPhone(renter.phone) ?? renter.phone,
			whatsapp: localPhone(renter.whatsapp) ?? '',
			telegram: renter.telegram ? `@${renter.telegram}` : ''
		},
		zod4(renterProfileSchema),
		{ errors: false }
	);
	return {
		form,
		files: { logoFile: renter.logoFile, coverFile: renter.coverFile },
		papers: { tinNumber: renter.tinNumber, tradeLicenceFile: renter.tradeLicenceFile }
	};
};

/** A new file replaces the stored one; a cleared one is removed; none keeps it. */
async function fileChange(data: FormData, name: string, file: File | undefined) {
	if (file && file.size > 0) return saveUploadedFile(file);
	if (data.get(removeFileField(name)) === '1') return null;
	return undefined;
}

export const actions = {
	default: async (event) => {
		const renter = await currentRenter(event.locals);
		const data = await event.request.clone().formData();
		const form = await superValidate(event.request, zod4(renterProfileSchema));
		const { logoFile, coverFile, ...input } = form.data;
		form.data.logoFile = undefined;
		form.data.coverFile = undefined;
		return formAttempt(
			form,
			async () => {
				let files;
				try {
					files = {
						logoFile: await fileChange(data, 'logoFile', logoFile),
						coverFile: await fileChange(data, 'coverFile', coverFile)
					};
				} catch (err) {
					if (err instanceof UploadRefused) throw new WriteRefused(null, err.message);
					throw err;
				}
				await updateProfile(renterActor(event), renter.id, input, files);
			},
			'Profile saved.'
		);
	}
};
