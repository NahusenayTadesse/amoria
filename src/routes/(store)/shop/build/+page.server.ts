import { giftProducts } from '$lib/server/services/catalog';

/**
 * "Create your own package" (§5.2): the shop's build-your-own boxes on one page, to choose a
 * container and fill it. The whole gift list comes too, since the bag prices its lines from it;
 * checkout itself stays on the shop page (`/shop?bag=1`).
 */
export const load = async () => ({ products: await giftProducts() });
