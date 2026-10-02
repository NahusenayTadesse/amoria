import { and, eq } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { numberSequence } from '$lib/server/db/schema';
import { documentNumber, ethiopianFiscalYear, type DOCUMENT_PREFIX } from '$lib/stockMath';

/**
 * The next paper number for `kind` on `day`: `AM-GRN-2019-00042`. Numbers restart each Ethiopian
 * fiscal year. The sequence row is locked until the caller's transaction ends, so two people
 * posting at once cannot draw the same number, and a posting that fails burns none.
 */
export async function nextNumber(
	tx: Writer,
	kind: keyof typeof DOCUMENT_PREFIX,
	day: string
): Promise<string> {
	const fiscalYear = ethiopianFiscalYear(day);
	await tx.insert(numberSequence).ignore().values({ docType: kind, fiscalYear, lastNumber: 0 });
	const [row] = await tx
		.select()
		.from(numberSequence)
		.where(and(eq(numberSequence.docType, kind), eq(numberSequence.fiscalYear, fiscalYear)))
		.for('update');
	const n = row.lastNumber + 1;
	await tx.update(numberSequence).set({ lastNumber: n }).where(eq(numberSequence.id, row.id));
	return documentNumber(kind, fiscalYear, n);
}
