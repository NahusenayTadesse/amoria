import { describe, expect, it } from 'vitest';
import { awayFromFreeDelivery, deliveryFee, qualifiesForFreeDelivery } from './delivery';

const free = { threshold: 3000, suggestAt: 2000 };

describe('deliveryFee', () => {
	it('charges the area fee below the threshold', () => {
		expect(deliveryFee(250, 2999.99, free)).toBe(250);
	});

	it('is free at and above the threshold', () => {
		expect(deliveryFee(250, 3000, free)).toBe(0);
		expect(deliveryFee(250, 5000, free)).toBe(0);
	});

	it('treats a threshold of 0 as "off", not as "everything is free"', () => {
		const off = { threshold: 0, suggestAt: 0 };
		expect(deliveryFee(250, 10_000, off)).toBe(250);
		expect(qualifiesForFreeDelivery(10_000, off)).toBe(false);
	});
});

describe('awayFromFreeDelivery', () => {
	it('says nothing while the bag is below the suggestion point', () => {
		expect(awayFromFreeDelivery(1999, free)).toBeNull();
	});

	it('says how much more once within reach', () => {
		expect(awayFromFreeDelivery(2000, free)).toBe(1000);
		expect(awayFromFreeDelivery(2549.5, free)).toBe(450.5);
	});

	it('says nothing once it already qualifies, or when free delivery is off', () => {
		expect(awayFromFreeDelivery(3000, free)).toBeNull();
		expect(awayFromFreeDelivery(2500, { threshold: 0, suggestAt: 0 })).toBeNull();
	});
});
