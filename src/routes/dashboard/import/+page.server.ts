import { fail } from '@sveltejs/kit';
import {
	COLUMNS,
	IMPORT_KINDS,
	ImportError,
	MAX_ROWS,
	planImport,
	readTable,
	runImport,
	type ImportKind,
	type SheetRow
} from '$lib/server/services/inventory/importer';
import { actorOf } from '$lib/server/paymentAdmin';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';

const KIND_NAMES: Record<ImportKind, string> = {
	products: 'Products',
	suppliers: 'Suppliers',
	opening: 'Opening stock'
};

const isKind = (v: unknown): v is ImportKind =>
	(IMPORT_KINDS as readonly string[]).includes(String(v));

export const load = () => ({
	kinds: IMPORT_KINDS.map((kind) => ({
		kind,
		name: KIND_NAMES[kind],
		columns: COLUMNS[kind].map((c) => ({ label: c.label, note: c.note ?? null, sample: c.sample }))
	})),
	maxRows: MAX_ROWS
});

export const actions = {
	/** Reads the file and says what would happen to every row. Writes nothing. */
	preview: async ({ request }) => {
		const data = await request.formData();
		const kind = data.get('kind');
		const file = data.get('file');
		if (!isKind(kind)) return fail(400, { error: 'Choose what you are importing.' });
		if (!(file instanceof File) || !file.size) return fail(400, { error: 'Choose a file.' });
		try {
			const { rows, ignored } = await readTable(kind, {
				name: file.name,
				bytes: new Uint8Array(await file.arrayBuffer())
			});
			const plan = await planImport(kind, rows);
			return { kind, fileName: file.name, ignored, plan, rows };
		} catch (err) {
			if (err instanceof ImportError) return fail(400, { error: err.message });
			throw err;
		}
	},

	/** Imports what the preview showed: the server plans it again first, and writes all or nothing. */
	confirm: async (event) => {
		const data = await event.request.formData();
		const kind = data.get('kind');
		if (!isKind(kind)) return fail(400, { error: 'Choose what you are importing.' });
		let rows: SheetRow[];
		try {
			rows = JSON.parse(String(data.get('rows') ?? '[]'));
			if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new Error('bad');
		} catch {
			return fail(400, { error: 'The preview could not be read. Upload the file again.' });
		}
		try {
			const result = await runImport(kind, rows, actorOf(event));
			return { imported: { kind, ...result } };
		} catch (err) {
			if (err instanceof ImportError || err instanceof WriteRefused) {
				return fail(409, { error: err.message });
			}
			throw err;
		}
	}
};
