import { giftProducts } from '$lib/server/services/catalog';
import { schoolCourses } from '$lib/server/services/school';
import { getSettings, publicContact } from '$lib/server/services/settings';
import { homePackages, homePortfolio } from '$lib/server/services/home';
import { showcaseListings } from '$lib/server/services/marketplace';

/**
 * The home page (§10): the four businesses, then what each has on show. Everything below the
 * first screen is optional — a section with nothing in it is left out rather than shown empty —
 * so a shop that has only stocked gifts still has a whole page.
 */
export const load = async () => {
	const [gifts, packages, portfolio, courses, settings, rentals] = await Promise.all([
		giftProducts().catch((err) => {
			console.error('Home: gifts:', err);
			return [];
		}),
		homePackages(),
		homePortfolio(),
		schoolCourses().catch((err) => {
			console.error('Home: school:', err);
			return [];
		}),
		getSettings(),
		showcaseListings(8).catch((err) => {
			console.error('Home: rentals:', err);
			return [];
		})
	]);

	// Staff picks first (the list arrives that way), then the newest, six in all.
	const featured = gifts
		.filter((gift) => gift.stockQty > 0)
		.slice(0, 6)
		.map((gift) => ({
			slug: gift.slug,
			name: gift.name,
			nameAm: gift.nameAm,
			price: gift.price,
			isFeatured: gift.isFeatured,
			image: gift.image,
			imageAlt: gift.imageAlt
		}));

	// The soonest intake with a seat, across all courses.
	const soonest = courses
		.flatMap((c) => (c.next ? [{ course: c, intake: c.next }] : []))
		.sort((a, b) => a.intake.startDate.localeCompare(b.intake.startDate))[0];
	const intake = soonest && {
		id: soonest.intake.id,
		courseSlug: soonest.course.slug,
		courseTitle: soonest.course.title,
		courseTitleAm: soonest.course.titleAm,
		startDate: soonest.intake.startDate,
		scheduleText: soonest.intake.scheduleText,
		fee: soonest.course.fee,
		seatsLeft: soonest.intake.seatsLeft
	};

	return {
		featured,
		packages,
		portfolio,
		rentals,
		intake: intake ?? null,
		contact: publicContact(settings)
	};
};
