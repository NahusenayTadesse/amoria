/**
 * Brings the test database's schema up to date once per `vitest` run, from the same `drizzle/`
 * migrations production uses — so the tests run against exactly what `db:migrate` would build.
 *
 * The database is `amoria_test`, never the development one: every DB test empties the tables it
 * uses before it starts (`src/lib/server/testing/db.ts`).
 */
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';

export const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ?? 'mysql://dev@localhost:3306/amoria_test';

export default async function setup() {
	const url = new URL(TEST_DATABASE_URL);
	const name = url.pathname.slice(1);
	if (!name.endsWith('_test')) {
		throw new Error(`Refusing to run DB tests against "${name}": the name must end in _test.`);
	}

	const server = await mysql.createConnection({ uri: TEST_DATABASE_URL.replace(`/${name}`, '/') });
	await server.query(
		`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
	);
	await server.end();

	const connection = await mysql.createConnection({ uri: TEST_DATABASE_URL });
	await migrate(drizzle(connection), { migrationsFolder: './drizzle' });
	await connection.end();
}
