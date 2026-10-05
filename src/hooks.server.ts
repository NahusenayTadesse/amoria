import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { configureKit } from '@nahu/admin-kit/server/db';
import { db } from '$lib/server/db';
import { kitHandle } from '@nahu/admin-kit/server/hooks';
import { access } from '$lib/access';
import { auditLog } from '$lib/server/db/schema';
import { piggybackJobs } from '$lib/server/services/jobs/runner';
import { loadGrant, seedPermissions } from '$lib/server/permissions';
import { isStaff } from '$lib/server/staff';

configureKit({ db, auditLog, loginPath: '/login' });

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

/**
 * Closes the better-auth endpoints nobody may call over HTTP (§4.3, §14 "At launch"):
 *   - sign-up: there are no customer accounts yet, and staff are created from the dashboard;
 *   - the admin plugin's endpoints, should it ever be added.
 * The app still creates accounts on the server through `auth.api`, which does not pass through here.
 */
const handleClosedEndpoints: Handle = ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path.startsWith('/api/auth/sign-up') || path.startsWith('/api/auth/admin')) {
		return new Response('Not found', { status: 404 });
	}
	return resolve(event);
};

/**
 * Permissions in step with the code on the first request after a boot (§4.4). Logged and
 * swallowed on failure: the app should open and say what is wrong rather than not start.
 */
let permissionSync: Promise<unknown> | undefined;
function syncPermissionsOnce() {
	if (building) return;
	permissionSync ??= seedPermissions()
		.then(({ created }) => {
			if (created) console.log(`[permissions] seeded ${created} new permission(s)`);
		})
		.catch((err) => {
			permissionSync = undefined;
			console.error('[permissions] sync failed:', err);
		});
	return permissionSync;
}

/** Paths that never need to know who is asking (§3.3: session lookups off the DB). */
const ANONYMOUS_PATHS = ['/media/', '/api/payments/', '/api/jobs/', '/api/push'];

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (ANONYMOUS_PATHS.some((path) => event.url.pathname.startsWith(path))) return resolve(event);

	await syncPermissionsOnce();

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

/** Background jobs ride on traffic too (§9); throttled, never awaited, never delays a response. */
const handleJobs: Handle = ({ event, resolve }) => {
	if (!building) piggybackJobs();
	return resolve(event);
};

/**
 * The user's real permissions, then the kit's route gate (§4.3 fix 1). Only active staff get any;
 * a customer — or anyone else signed in — gets an empty list and is not a super admin.
 */
const handleKit = kitHandle({
	access,
	permissions: (event) =>
		isStaff(event.locals.user)
			? loadGrant(event.locals.user!.id)
			: { permList: [], isSuperAdmin: false }
});

export const handle: Handle = sequence(
	handleJobs,
	handleParaglide,
	handleClosedEndpoints,
	handleBetterAuth,
	handleKit
);
