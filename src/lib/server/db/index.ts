import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from './connection';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// UTC sessions and §3.3 pool limits — see `connection.ts`.
const client = createPool(env.DATABASE_URL);

export const db = drizzle(client, { schema, mode: 'default' });
