/**
 * The one way this app opens a MySQL/MariaDB connection: a small pool whose sessions run in UTC.
 *
 * **UTC (from dentalClinic).** Drizzle writes and reads `datetime`/`timestamp` as UTC wall clock.
 * Left alone, the database runs each session in the host's zone, so anything *it* stamps —
 * `DEFAULT now()`, `ON UPDATE CURRENT_TIMESTAMP`, `NOW()` in the job lock — would be three hours
 * off. `SET time_zone` on each connection makes the database's clock agree with Drizzle's;
 * `timezone: 'Z'` does the same for a raw `Date` parameter. "Today" still comes from the kit's
 * `localToday()`, never `CURDATE()`, which is yesterday in Addis Ababa until 03:00.
 *
 * **Small (§3.3).** A 2 GB shared account, and hosts cap `max_user_connections`.
 *
 * No SvelteKit imports, so seed and migration scripts can use it too.
 */
import mysql from 'mysql2/promise';

export const SESSION_TIME_ZONE = '+00:00';

export function createPool(url: string) {
	const pool = mysql.createPool({
		uri: url,
		timezone: 'Z',
		connectionLimit: 5,
		maxIdle: 2,
		idleTimeout: 60_000,
		enableKeepAlive: true,
		queueLimit: 50
	});

	// Runs on each new connection before it is handed out; queries on a connection run in order.
	pool.pool.on('connection', (connection) => {
		connection.query(`SET time_zone = '${SESSION_TIME_ZONE}'`);
	});

	return pool;
}
