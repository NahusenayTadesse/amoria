import { getLocale } from '$lib/paraglide/runtime';
import { formatETB, formatEthiopianDate } from '@nahu/admin-kit/global';
import { ethiopianClock, localClock, LOCAL_TIME_ZONE } from '@nahu/admin-kit/time';

/**
 * The Amharic column when the visitor reads Amharic and it has been filled in, else the English
 * one (§5.0 bilingual content):
 *
 *     localized(product, 'name')   // product.nameAm ?? product.name, in Amharic
 */
export function localized<K extends string>(
	row: Record<K, string | null> & Partial<Record<`${K}Am`, string | null>>,
	field: K
): string {
	if (getLocale() === 'am') {
		const am = row[`${field}Am` as `${K}Am`];
		if (am) return am as string;
	}
	return row[field] ?? '';
}

/** Birr in the visitor's language: `ETB 1,250.00`, or its Amharic form. */
export function birr(amount: number | null | undefined): string {
	return formatETB(amount, getLocale() === 'am');
}

/**
 * A day on both calendars, as the storefront shows dates (§5.0): the Ethiopian date people use,
 * and the Gregorian one the receipts and banks use.
 */
export function bothCalendars(instant: Date): string {
	const gregorian = new Intl.DateTimeFormat(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
		dateStyle: 'medium',
		timeZone: LOCAL_TIME_ZONE
	}).format(instant);
	const ethiopian = formatEthiopianDate(instant);
	// Each reader sees their own calendar first, the other in brackets.
	return getLocale() === 'am' ? `${ethiopian} (${gregorian})` : `${gregorian} (${ethiopian})`;
}

/** A time said both ways, since "9:00" is heard as three in the afternoon on the Ethiopian clock. */
export function bothClocks(instant: Date): string {
	return `${localClock(instant)} (${ethiopianClock(instant)})`;
}

/**
 * A stored business day (`YYYY-MM-DD`, the Addis Ababa day) on both calendars. Noon local time, so
 * no time-zone conversion can move it to the neighbouring day.
 */
export function bothCalendarsOnDay(day: string): string {
	return bothCalendars(new Date(`${day}T12:00:00+03:00`));
}

/**
 * A day as short as it can be on a chip: "12 Oct" for an English reader, the Ethiopian "2 ጥቅምት"
 * for an Amharic one. The full date, on both calendars, is shown beside it.
 */
export function shortDay(day: string): string {
	const instant = new Date(`${day}T12:00:00+03:00`);
	if (getLocale() === 'am') return formatEthiopianDate(instant).replace(/\s+\d{3,4}$/, '');
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: LOCAL_TIME_ZONE
	}).format(instant);
}
