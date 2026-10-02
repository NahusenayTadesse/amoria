import { fail } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';

/**
 * Runs a service call for a one-click button. A refusal (`WriteRefused`) becomes a plain sentence
 * the page toasts (`$lib/quick`); anything else is a real fault and is thrown. On success the
 * action answers `{ done }` plus whatever the call returned (an id to go to, a number).
 */
export async function attempt<T extends Record<string, unknown> | void>(
	run: () => Promise<T>,
	done: string
) {
	try {
		const result = await run();
		return { done, ...(result ?? {}) };
	} catch (err) {
		if (err instanceof WriteRefused) return fail(409, { error: err.message });
		throw err;
	}
}
