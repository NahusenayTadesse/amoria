import { describe, expect, it } from 'vitest';
import { addDays, courseDays, lastDay, planRuns, upcomingRanges } from './schoolPlan';

describe('courseDays', () => {
	it('uses the course length, or 20 when none is given', () => {
		expect(courseDays(10)).toBe(10);
		expect(courseDays(null)).toBe(20);
		expect(courseDays(undefined)).toBe(20);
		expect(courseDays(0)).toBe(20);
	});
});

describe('addDays and lastDay', () => {
	it('crosses month and year ends', () => {
		expect(addDays('2026-12-25', 10)).toBe('2027-01-04');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('counts the first day as day one', () => {
		expect(lastDay('2026-10-01', 20)).toBe('2026-10-20');
		expect(lastDay('2026-10-01', 1)).toBe('2026-10-01');
	});
});

describe('planRuns', () => {
	it('fills the range with back-to-back runs that finish inside it', () => {
		expect(planRuns('2026-10-01', '2026-12-31', 20)).toEqual([
			{ startDate: '2026-10-01', endDate: '2026-10-20' },
			{ startDate: '2026-10-21', endDate: '2026-11-09' },
			{ startDate: '2026-11-10', endDate: '2026-11-29' },
			{ startDate: '2026-11-30', endDate: '2026-12-19' }
		]);
	});

	it('defaults to 20-day runs', () => {
		expect(planRuns('2026-10-01', '2026-11-09', null)).toHaveLength(2);
	});

	it('keeps a run that ends exactly on the last day, and nothing for a short range', () => {
		expect(planRuns('2026-10-01', '2026-10-20', 20)).toHaveLength(1);
		expect(planRuns('2026-10-01', '2026-10-19', 20)).toEqual([]);
	});

	it('plans nothing for a backwards or missing range, and stops at the limit', () => {
		expect(planRuns('2026-10-10', '2026-10-01', 5)).toEqual([]);
		expect(planRuns('', '2026-10-01', 5)).toEqual([]);
		expect(planRuns('2026-01-01', '2030-01-01', 1, 7)).toHaveLength(7);
	});
});

describe('upcomingRanges', () => {
	const c = (id: number, startDate: string, seatsLeft: number) => ({
		id,
		startDate,
		endDate: lastDay(startDate, 20),
		seatsLeft
	});

	it('groups the shifts of one date range together', () => {
		const ranges = upcomingRanges([c(1, '2026-10-01', 0), c(2, '2026-10-01', 4)]);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].classes.map((x) => x.id)).toEqual([1, 2]);
		expect(ranges[0].seatsLeft).toBe(4);
	});

	it('offers four ranges with seats, keeping full ones that come before them', () => {
		const classes = [
			c(1, '2026-10-01', 0),
			c(2, '2026-10-21', 3),
			c(3, '2026-11-10', 1),
			c(4, '2026-11-30', 2),
			c(5, '2026-12-20', 5),
			c(6, '2027-01-09', 5)
		];
		expect(upcomingRanges(classes).map((r) => r.startDate)).toEqual([
			'2026-10-01',
			'2026-10-21',
			'2026-11-10',
			'2026-11-30',
			'2026-12-20'
		]);
	});
});
