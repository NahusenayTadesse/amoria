import { fail } from '@sveltejs/kit';
import { message, setError, type SuperValidated } from 'sveltekit-superforms';
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

/**
 * The same for a `FormDialog` (superforms): a refusal lands as the form's message, or under its
 * field when the refusal names one; success closes the dialog with `done`.
 */
export async function formAttempt<F extends SuperValidated<Record<string, unknown>>>(
	form: F,
	run: () => Promise<unknown>,
	done: string
) {
	if (!form.valid) {
		return message(form, { type: 'error', text: 'Check the highlighted fields.' }, { status: 400 });
	}
	try {
		await run();
	} catch (err) {
		if (err instanceof WriteRefused) {
			if (err.field) return setError(form, err.field as '', err.message);
			return message(form, { type: 'error', text: err.message }, { status: 409 });
		}
		throw err;
	}
	return message(form, { type: 'success', text: done });
}
