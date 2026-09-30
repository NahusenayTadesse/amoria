import { getSettings, publicContact } from '$lib/server/services/settings';

/**
 * Not prerendered, though §10 lists `/contact` among the static pages: the phone, chat handles and
 * address are Settings (§5.10) that staff edit, and a prerendered page would freeze whatever the
 * database held at build time. The read is cached, so this costs no query per visit.
 */
export const load = async () => ({ contact: publicContact(await getSettings()) });
