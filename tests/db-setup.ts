/**
 * What `hooks.server.ts` does at boot that services rely on — here for the DB tests, which never
 * load the hooks: the kit's database and audit table.
 */
import { afterAll } from 'vitest';
import { configureKit } from '@nahu/admin-kit/server/db';
import { db } from '$lib/server/db';
import { auditLog } from '$lib/server/db/schema';

configureKit({ db, auditLog, loginPath: '/login' });

// Each test file gets its own module graph, and so its own connection pool: close it when the file
// is done, or the open sockets keep vitest from exiting.
afterAll(() => db.$client.end());
