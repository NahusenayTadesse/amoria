import type { auth } from '$lib/server/auth';

type AuthSession = typeof auth.$Infer.Session;

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		/** Shallow-routing state: a sheet open over the page, closed by the Back button. */
		interface PageState {
			sheet?: 'more' | 'product';
			/** The open sheet's gift or bundle, by its shop key (`p12`, `b3`). */
			productKey?: string;
		}
		interface Locals {
			permList: string[];
			isSuperAdmin: boolean;
			/** better-auth's user, with Amoria's own columns (`role`, `roleId`, `phone`, …). */
			user?: AuthSession['user'];
			session?: AuthSession['session'];
		}
	}
}

export {};
