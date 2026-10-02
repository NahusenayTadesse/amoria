/**
 * The décor school's calendar arithmetic (§5.6), shared by the class builder in the browser, the
 * server that saves its classes, and the storefront's date picker. Days are business days as
 * stored: Gregorian `YYYY-MM-DD` strings meaning the Addis Ababa day.
 */

/** One run of a course lasts this many days when the course does not say otherwise. */
export const DEFAULT_COURSE_DAYS = 20;

/** How many upcoming date ranges with a free seat the registration page offers. */
export const REGISTER_RANGES = 4;

/** The most classes one use of the class builder may create. */
export const MAX_PLANNED_CLASSES = 200;

/** A course's run length in days: its own, or the default of 20. */
export function courseDays(days: number | null | undefined): number {
	return days && days > 0 ? Math.floor(days) : DEFAULT_COURSE_DAYS;
}

/** `day` moved by `n` days (negative goes back). Calendar arithmetic only, so no time zone. */
export function addDays(day: string, n: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + n);
	return date.toISOString().slice(0, 10);
}

/** The last day of a run starting on `start`: a 20-day course starting on the 1st ends on the 20th. */
export function lastDay(start: string, days: number): string {
	return addDays(start, courseDays(days) - 1);
}

/** A class is one course, one first day, one shift: the key the builder and the server match on. */
export const classKey = (startDate: string, shiftId: number | null) =>
	`${startDate}|${shiftId ?? 0}`;

export type PlannedRun = { startDate: string; endDate: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Back-to-back runs of a course filling `from`..`to`: the first starts on `from`, each next one the
 * day after the last ended, and only runs that finish by `to` are kept. An impossible range (or a
 * missing day) plans nothing. Capped at `limit` runs.
 */
export function planRuns(
	from: string,
	to: string,
	days: number | null | undefined,
	limit = MAX_PLANNED_CLASSES
): PlannedRun[] {
	if (!DAY.test(from) || !DAY.test(to) || to < from) return [];
	const length = courseDays(days);
	const runs: PlannedRun[] = [];
	for (let start = from; runs.length < limit; start = addDays(start, length)) {
		const end = lastDay(start, length);
		if (end > to) break;
		runs.push({ startDate: start, endDate: end });
	}
	return runs;
}

/** A class, as far as the date picker needs it. */
export type ClassOption = {
	id: number;
	startDate: string;
	endDate: string | null;
	seatsLeft: number;
};

export type DateRange<T extends ClassOption> = {
	startDate: string;
	endDate: string | null;
	/** The range's classes, one per shift, in the order given. */
	classes: T[];
	/** Free seats across its classes. */
	seatsLeft: number;
};

/**
 * Groups classes (sorted by start date) into date ranges, and keeps the first `ranges` of them
 * that still have a free seat. Full ranges before the last one kept are kept too, so a guest sees
 * that the earlier dates are taken rather than wondering where they went.
 */
export function upcomingRanges<T extends ClassOption>(
	classes: T[],
	ranges = REGISTER_RANGES
): DateRange<T>[] {
	const grouped: DateRange<T>[] = [];
	for (const option of classes) {
		const last = grouped.at(-1);
		if (last && last.startDate === option.startDate && last.endDate === option.endDate) {
			last.classes.push(option);
			last.seatsLeft += option.seatsLeft;
		} else {
			grouped.push({
				startDate: option.startDate,
				endDate: option.endDate,
				classes: [option],
				seatsLeft: option.seatsLeft
			});
		}
	}

	const kept: DateRange<T>[] = [];
	let open = 0;
	for (const range of grouped) {
		if (open >= ranges) break;
		kept.push(range);
		if (range.seatsLeft > 0) open++;
	}
	return kept;
}
