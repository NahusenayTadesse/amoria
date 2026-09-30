import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
	it.each([
		['Red Rose Bouquet', 'red-rose-bouquet'],
		['  Coffee lover’s box!! ', 'coffee-lover-s-box'],
		['Crème Brûlée Set', 'creme-brulee-set'],
		['Box #2 (large)', 'box-2-large'],
		['--already--dashed--', 'already-dashed']
	])('%s → %s', (input, expected) => {
		expect(slugify(input)).toBe(expected);
	});

	it('gives an empty slug for an Amharic-only name, which the caller then refuses', () => {
		expect(slugify('የሱፍ አበባ')).toBe('');
	});

	it('stays within the column', () => {
		expect(slugify('a'.repeat(300)).length).toBeLessThanOrEqual(150);
	});
});
