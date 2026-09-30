import { describe, expect, it, vi } from 'vitest';

const transactionMock = vi.fn();
vi.mock('$lib/server/db', () => ({
	db: { transaction: (body: unknown) => transactionMock(body) }
}));

const { isConflict, transaction } = await import('./retry');

/** An error shaped like Drizzle's: the driver's error with its `code` sits in `cause`. */
const drizzleError = (code: string) =>
	Object.assign(new Error('Failed query'), { cause: Object.assign(new Error(code), { code }) });

describe('isConflict', () => {
	it('recognises deadlocks and snapshot conflicts, however wrapped', () => {
		expect(isConflict(drizzleError('ER_LOCK_DEADLOCK'))).toBe(true);
		expect(isConflict(drizzleError('ER_CHECKREAD'))).toBe(true);
		expect(isConflict(Object.assign(new Error(), { code: 'ER_CHECKREAD' }))).toBe(true);
	});

	it('does not retry real errors', () => {
		expect(isConflict(drizzleError('ER_DUP_ENTRY'))).toBe(false);
		expect(isConflict(new Error('Only 3 left'))).toBe(false);
		expect(isConflict(undefined)).toBe(false);
	});
});

describe('transaction', () => {
	it('runs the body again after a conflict, and returns its result', async () => {
		transactionMock.mockReset();
		transactionMock
			.mockRejectedValueOnce(drizzleError('ER_CHECKREAD'))
			.mockResolvedValueOnce('placed');
		expect(await transaction(async () => 'placed')).toBe('placed');
		expect(transactionMock).toHaveBeenCalledTimes(2);
	});

	it('gives up after three attempts', async () => {
		transactionMock.mockReset();
		transactionMock.mockRejectedValue(drizzleError('ER_LOCK_DEADLOCK'));
		await expect(transaction(async () => 1)).rejects.toThrow('Failed query');
		expect(transactionMock).toHaveBeenCalledTimes(3);
	});

	it('does not retry an ordinary failure', async () => {
		transactionMock.mockReset();
		transactionMock.mockRejectedValue(new Error('That is sold out'));
		await expect(transaction(async () => 1)).rejects.toThrow('sold out');
		expect(transactionMock).toHaveBeenCalledTimes(1);
	});
});
