import { toast } from 'svelte-sonner';

/**
 * The `use:enhance` callback for a one-click dashboard button: the action returns `{ done }` or
 * fails with `{ error }`, a toast says which, and the page reloads its data.
 *
 *     <form method="POST" action="?/status" use:enhance={quick}>
 */
export const quick = () => {
	return async ({
		result,
		update
	}: {
		result: { type: string; data?: Record<string, unknown> };
		update: () => Promise<void>;
	}) => {
		if (result.type === 'success') toast.success(String(result.data?.done ?? 'Done'));
		else if (result.type === 'failure')
			toast.error(String(result.data?.error ?? 'That did not work'));
		await update();
	};
};
