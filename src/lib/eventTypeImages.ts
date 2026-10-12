/**
 * A photo for each event type on the "Plan your décor" picker. Event types have no photo of their
 * own yet, so the seeded slugs get one of the décor photos the site already ships; a type staff
 * add later falls back to a general one until it is given its own here.
 */
const BY_SLUG: Record<string, string> = {
	wedding: '/images/demo/gallery-ceremony-chairs-480.webp',
	engagement: '/images/demo/gallery-aisle-chairs-480.webp',
	birthday: '/images/demo/gallery-centerpiece-480.webp',
	'baby-shower': '/images/demo/gallery-table-garden-480.webp',
	graduation: '/images/demo/gallery-gold-letters-480.webp',
	corporate: '/images/demo/gallery-long-table-480.webp'
};

const FALLBACK = '/images/demo/gallery-floral-tables-480.webp';

/** For "Not sure yet": the décor without a particular occasion. */
export const EVENT_TYPE_UNSURE_IMAGE = '/images/demo/gallery-hall-drapes-480.webp';

export function eventTypeImage(slug: string): string {
	return BY_SLUG[slug] ?? FALLBACK;
}
