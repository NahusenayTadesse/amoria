import { renterDirectory } from '$lib/server/services/marketplace';

/** Every approved renter (`/renters`, §5.12), featured first. */
export const load = async () => ({ renters: await renterDirectory() });
