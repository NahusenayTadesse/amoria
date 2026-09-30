/**
 * Background work, run inside the app (§9): there are no DB events or host schedulers to lean on.
 *
 * `maybeRunDueJobs()` is called two ways: piggybacked on requests from `hooks.server.ts` (never
 * awaited, at most once per 30 s per process), and from `POST /api/jobs/tick`, which a cPanel cron
 * hits every minute so jobs run while the app is idle. Either way each job runs only when it is
 * due and only if it takes its `job_lock` row, so two triggers at once never run a job twice.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { jobLock } from '$lib/server/db/schema';
import { JOBS } from './registry';

const PIGGYBACK_EVERY_MS = 30_000;
let lastPiggyback = 0;
/**
 * One row per job (§9 "Seeding"): the lock is a conditional `UPDATE`, which matches nothing — and
 * so silently never runs the job — when the row is missing.
 *
 * Done on every run, not once per process: a row deleted while the app is up (a cleared table, a
 * restored dump) would otherwise stop that job until the next restart, with no error anywhere.
 * `INSERT IGNORE` of a handful of rows once a tick costs nothing. Found by `platform.db.test.ts`.
 */
async function seedLocks() {
	await db
		.insert(jobLock)
		.ignore()
		.values(JOBS.map((job) => ({ name: job.name })));
}

/** From a request: throttled, never awaited by the caller, never throws. */
export function piggybackJobs() {
	const now = Date.now();
	if (now - lastPiggyback < PIGGYBACK_EVERY_MS) return;
	lastPiggyback = now;
	maybeRunDueJobs().catch((err) => console.error('Background jobs failed:', err));
}

export type JobReport = { name: string; ran: boolean; result?: unknown; error?: string };

/** Runs every job that is due and not locked by another trigger. */
export async function maybeRunDueJobs(): Promise<JobReport[]> {
	await seedLocks();
	const reports: JobReport[] = [];

	for (const job of JOBS) {
		/*
		 * Due and unlocked in one statement: `locked_until` doubles as "not before", set to the
		 * job's interval on success, so a job that just ran is simply still "locked". The lock
		 * outlasts a stuck run by the timeout, after which another trigger may take it.
		 */
		const [taken] = await db.execute(sql`
			UPDATE ${jobLock}
			SET locked_until = NOW() + INTERVAL ${job.timeoutSeconds} SECOND
			WHERE name = ${job.name} AND (locked_until IS NULL OR locked_until < NOW())
		`);
		if ((taken as unknown as { affectedRows: number }).affectedRows !== 1) {
			reports.push({ name: job.name, ran: false });
			continue;
		}

		try {
			const result = await job.run();
			await db.execute(sql`
				UPDATE ${jobLock}
				SET locked_until = NOW() + INTERVAL ${job.everySeconds} SECOND, last_run_at = NOW(), last_error = NULL
				WHERE name = ${job.name}
			`);
			reports.push({ name: job.name, ran: true, result });
		} catch (err) {
			const message = (err instanceof Error ? err.message : String(err)).slice(0, 255);
			console.error(`Job ${job.name} failed:`, err);
			// Retry after the normal interval rather than hammering a failing dependency.
			await db.execute(sql`
				UPDATE ${jobLock}
				SET locked_until = NOW() + INTERVAL ${job.everySeconds} SECOND, last_run_at = NOW(), last_error = ${message}
				WHERE name = ${job.name}
			`);
			reports.push({ name: job.name, ran: true, error: message });
		}
	}

	return reports;
}
