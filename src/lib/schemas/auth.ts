import { z } from 'zod/v4';

export const loginSchema = z.object({
	email: z.email('Enter your email address').trim().toLowerCase(),
	password: z.string().min(1, 'Enter your password')
});

/** The first admin, created once from `/setup`. */
export const setupSchema = z.object({
	name: z.string().trim().min(2, 'Enter your name').max(120),
	email: z.email('Enter an email address').trim().toLowerCase(),
	password: z.string().min(10, 'Use at least 10 characters').max(128)
});
