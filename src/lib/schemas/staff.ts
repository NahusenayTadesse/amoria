import { z } from 'zod/v4';
import { INVALID_PHONE_MESSAGE, isEthiopianPhone } from '@nahu/admin-kit/phone';

/** Staff accounts and roles, for the admin panel. Shared by the page and the action. */

/** Edit forms are seeded from the row, where an empty optional column is `null`. */
const optionalText = (max: number) =>
	z.preprocess((v) => (v === null || v === undefined ? '' : v), z.string().trim().max(max));

const phone = z.preprocess(
	(v) => (v === null || v === undefined ? '' : v),
	z
		.string()
		.trim()
		.refine((v) => v === '' || isEthiopianPhone(v), INVALID_PHONE_MESSAGE)
);

/** The same minimum as `/setup`: these accounts reach the dashboard. */
const password = z.string().min(10, 'Use at least 10 characters').max(128);

const roleId = z.coerce.number().int().positive('Choose a role');

export const staffAdd = z.object({
	name: z.string().trim().min(2, 'Enter their name').max(120),
	email: z.email('Enter an email address').trim().toLowerCase(),
	phone,
	roleId,
	password
});

export const staffEdit = z.object({
	name: z.string().trim().min(2, 'Enter their name').max(120),
	email: z.email('Enter an email address').trim().toLowerCase(),
	phone,
	roleId
});

export const passwordReset = z.object({ password });

export const roleAdd = z.object({
	name: z.string().trim().min(2, 'Name the role').max(32, 'Keep it under 32 characters'),
	description: optionalText(255)
});

export const roleEdit = roleAdd.extend({ isActive: z.boolean().default(true) });

/** The ticked boxes of a permission checklist; none ticked posts nothing. */
export const permissionPick = z.object({
	permissionIds: z.array(z.coerce.number().int().positive()).default([])
});
