import { json, type RequestHandler } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { maybeRunDueJobs } from '$lib/server/services/jobs/runner';

/**
 * The job trigger a cPanel cron hits every minute (§9, required in production):
 *
 *     curl -fsS -X POST -H "Authorization: Bearer $JOBS_SECRET" https://amoria.et/api/jobs/tick
 *
 * Returns what ran, for the cron's log.
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.JOBS_SECRET?.trim();
	const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
	if (
		!secret ||
		given.length !== secret.length ||
		!timingSafeEqual(Buffer.from(given), Buffer.from(secret))
	) {
		return json({ error: 'Unauthorised.' }, { status: 401 });
	}

	return json({ jobs: await maybeRunDueJobs() });
};
