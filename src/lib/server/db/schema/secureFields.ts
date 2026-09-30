import { fieldMixins } from '@nahu/admin-kit/server/schema';
import { user } from './auth';

/** The kit's column sets, bound to this app's `user` table. See `fieldMixins`. */
export const { deletionFields, secureFields, lesserFields, approvalFields } = fieldMixins(
	() => user.id
);
