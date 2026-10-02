import { error } from '@sveltejs/kit';
import {
	IMPORT_KINDS,
	templateCsv,
	type ImportKind
} from '$lib/server/services/inventory/importer';

/** A CSV with the headings an import reads and one sample row, to fill in and upload. */
export const GET = ({ params }) => {
	const kind = params.kind as ImportKind;
	if (!IMPORT_KINDS.includes(kind)) error(404, 'No such template');
	return new Response(`\uFEFF${templateCsv(kind)}\n`, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="amoria-${kind}-template.csv"`
		}
	});
};
