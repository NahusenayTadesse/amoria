import { servePublicFile } from '@nahu/admin-kit/server/servePublicFile';
import { isPublicFile } from '$lib/server/files';

/** Product, package, portfolio and course images for guests (§5.2). Anything else is a 404. */
export const GET = servePublicFile({ isPublic: isPublicFile });
