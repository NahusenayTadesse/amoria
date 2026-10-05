import { expireHolds } from '../orders';
import { expireRegistrations } from '../school';
import { reconcileStale } from '../payments';
import { sendClassReminders } from '../push';

export type Job = {
	name: string;
	/** How long after a successful run it is due again. */
	everySeconds: number;
	/** How long a run may hold the lock before another trigger may take it. */
	timeoutSeconds: number;
	/** Idempotent and bounded (about 50 rows); returns something worth logging. */
	run: () => Promise<unknown>;
};

/** §9's table. The rest join as their services are built. */
export const JOBS: Job[] = [
	{
		name: 'expire-holds',
		everySeconds: 60,
		timeoutSeconds: 120,
		run: async () => ({
			orders: await expireHolds(),
			registrations: await expireRegistrations()
		})
	},
	{
		name: 'class-reminders',
		everySeconds: 3600,
		timeoutSeconds: 300,
		run: () => sendClassReminders()
	},
	{
		name: 'reconcile-payments',
		everySeconds: 300,
		timeoutSeconds: 300,
		run: () => reconcileStale()
	}
];
