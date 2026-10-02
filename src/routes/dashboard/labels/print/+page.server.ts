import { error } from '@sveltejs/kit';
import { labelsFor } from '$lib/server/services/inventory/barcodes';

const MAX_LABELS = 600;

/** The label sheet: chosen products (`ids`) or a delivery (`document`), each `copies` times. */
export const load = async ({ url }) => {
	const document = Number(url.searchParams.get('document'));
	const ids = url.searchParams
		.getAll('ids')
		.flatMap((v) => v.split(','))
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0);
	const copies = Math.min(50, Math.max(1, Number(url.searchParams.get('copies')) || 1));

	const labels =
		Number.isInteger(document) && document > 0
			? await labelsFor({ documentId: document })
			: await labelsFor({ productIds: ids });
	if (!labels.length) error(404, 'Nothing to print. Choose some products or a delivery.');

	const sheet = labels.flatMap((l) => Array.from({ length: copies }, () => l)).slice(0, MAX_LABELS);
	return { sheet, truncated: labels.length * copies > MAX_LABELS };
};
