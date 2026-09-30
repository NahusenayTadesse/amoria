import { randomBytes } from 'node:crypto';

/**
 * The token in `/o/…`, `/r/…`, `/q/…`, `/reg/…`: 128 random bits, base64url (22 characters).
 * Holding it is what lets a guest see and pay their own record, so it is never derived from an id.
 */
export function publicToken(): string {
	return randomBytes(16).toString('base64url');
}

/** Ref prefixes by record: `AM-O-000123` for an order. */
export const REF_PREFIX = {
	order: 'AM-O',
	rental: 'AM-R',
	quote: 'AM-Q',
	registration: 'AM-S'
} as const;

/** The human number, formatted from the id once the insert has returned it. */
export function formatRef(kind: keyof typeof REF_PREFIX, id: number): string {
	return `${REF_PREFIX[kind]}-${String(id).padStart(6, '0')}`;
}

/**
 * A payment attempt's reference, sent to Chapa and echoed back: `am-o-123-<random>`. The record is
 * readable in it for tracing a webhook by eye; the random part makes it unguessable.
 */
export function newTxRef(kind: 'o' | 'r' | 'qd' | 'qb' | 's', id: number): string {
	return `am-${kind}-${id}-${randomBytes(9).toString('hex')}`;
}
