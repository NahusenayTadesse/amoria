import { error, redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localToday } from '@nahu/admin-kit/time';
import { DOCUMENT_LABELS } from '$lib/stock';
import { documentHeader } from '$lib/schemas/inventory';
import { locationOptions, supplierOptions } from '$lib/server/options';
import { actorOf } from '$lib/server/paymentAdmin';
import { headerOf } from '$lib/server/documentForm';
import { saveHeader } from '$lib/server/services/inventory/documents';

const CREATABLE = ['receipt', 'issue', 'transfer', 'adjustment'] as const;
type Creatable = (typeof CREATABLE)[number];

function kindOf(url: URL): Creatable {
	const type = url.searchParams.get('type');
	if (!CREATABLE.includes(type as Creatable)) error(404, 'Choose what kind of document to make.');
	return type as Creatable;
}

export const load = async ({ url }) => {
	const type = kindOf(url);
	const [locations, suppliers] = await Promise.all([
		locationOptions({ withQuarantine: type === 'transfer' || type === 'adjustment' }),
		supplierOptions()
	]);
	return {
		type,
		title: `New ${DOCUMENT_LABELS[type].toLowerCase()}`,
		locations,
		suppliers,
		form: await superValidate({ type, docDate: localToday() }, zod4(documentHeader))
	};
};

export const actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(documentHeader));
		if (!form.valid) return fail(400, { form });
		if (!CREATABLE.includes(form.data.type as Creatable)) {
			return message(
				form,
				{ type: 'error', text: 'Returns are made from the sale or delivery.' },
				{ status: 400 }
			);
		}
		let id: number;
		try {
			id = await saveHeader(
				{
					header: headerOf(form.data)
				},
				actorOf(event)
			);
		} catch (err) {
			if (err instanceof WriteRefused) {
				return message(form, { type: 'error', text: err.message }, { status: 409 });
			}
			throw err;
		}
		redirect(303, `/dashboard/stock/documents/${id}`);
	}
};
