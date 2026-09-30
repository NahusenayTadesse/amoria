import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	emailAndPassword: { enabled: true },
	/**
	 * Amoria's own `user` columns (`schema/auth.ts`). `input: false` on everything that decides
	 * access, so a sign-up can never make itself staff (§4.3).
	 */
	user: {
		additionalFields: {
			role: { type: 'string', required: false, defaultValue: 'customer', input: false },
			roleId: { type: 'number', required: false, input: false },
			isActive: { type: 'boolean', required: false, defaultValue: true, input: false },
			phone: { type: 'string', required: false, input: false },
			locale: { type: 'string', required: false, defaultValue: 'en', input: false },
			telegramChatId: { type: 'string', required: false, input: false }
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
