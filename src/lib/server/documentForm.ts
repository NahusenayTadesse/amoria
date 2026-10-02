import type { z } from 'zod/v4';
import type { ADJUSTMENT_REASONS } from '$lib/constants';
import type { documentHeader } from '$lib/schemas/inventory';
import type { DocHeaderInput } from '$lib/server/services/inventory/documents';

/** A validated header form as the service takes it: empty boxes become nulls, the reason a real one. */
export function headerOf(data: z.infer<typeof documentHeader>): DocHeaderInput {
	return {
		...data,
		reason: (data.reason || null) as (typeof ADJUSTMENT_REASONS)[number] | null,
		note: data.note || null,
		party: data.party || null,
		reference: data.reference || null
	};
}
