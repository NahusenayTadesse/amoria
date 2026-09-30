import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { globSync, readFileSync } from 'node:fs';

/**
 * Every package the browser-side code imports, found by reading `src`, for `optimizeDeps.include`.
 *
 * **Why.** Vite's startup scan cannot read the admin-kit's `.svelte` files (it fails on their
 * relative imports), so without this nothing is pre-bundled. The first visit to a page then makes
 * Vite discover that page's dependencies, bundle them and reload — and the page's own module, still
 * loading, fails with "Failed to fetch dynamically imported module": the shop page crashed on the
 * first visit after every cache reset. Listing them up front bundles everything at startup.
 *
 * Built from the source rather than written out, so a new icon or kit component is picked up
 * without anyone remembering this list. Type-only imports and server code are skipped.
 */
function clientDependencies(): string[] {
	const skip =
		/^(\$|\.|node:|svelte$|svelte\/|@sveltejs\/kit|drizzle|mysql2|better-auth|vitest|@nahu\/admin-kit\/server)/;
	const found = new Set<string>();
	for (const file of globSync('src/**/*.{svelte,ts}')) {
		if (/\/server\/|\.(spec|test)\.|\.d\.ts$|\/paraglide\//.test(file)) continue;
		const code = readFileSync(file, 'utf8');
		for (const [, typeOnly, specifier] of code.matchAll(
			/^\s*import\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm
		)) {
			if (!typeOnly && !skip.test(specifier)) found.add(specifier);
		}
	}
	return [...found].sort();
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// `/…` English, `/am/…` Amharic (§1), then the visitor's last choice.
			strategy: ['url', 'cookie', 'baseLocale']
		})
	],
	optimizeDeps: { include: clientDependencies() },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.db.{test,spec}.{js,ts}']
				}
			},

			{
				// Services against a real MariaDB (`amoria_test`), one file at a time: each test empties
				// the tables it uses, so two files running together would wipe each other's rows.
				extends: './vite.config.ts',
				test: {
					name: 'db',
					environment: 'node',
					include: ['src/**/*.db.{test,spec}.{js,ts}'],
					globalSetup: ['./tests/db-global-setup.ts'],
					setupFiles: ['./tests/db-setup.ts'],
					fileParallelism: false,
					testTimeout: 20_000,
					env: {
						DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'mysql://dev@localhost:3306/amoria_test',
						CHAPA_SECRET_KEY: 'CHASECK_TEST-unit-tests',
						CHAPA_WEBHOOK_SECRET: 'unit-test-webhook-secret',
						FILES_DIR: '.tempFiles-test'
					}
				}
			}
		]
	}
});
