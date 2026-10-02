import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, inStoreBarcode, isValidEan13 } from './barcode';

describe('EAN-13', () => {
	it('computes the check digit of known codes', () => {
		// 4006381333931 is the standard worked example; 5901234123457 is another.
		expect(ean13CheckDigit('400638133393')).toBe(1);
		expect(ean13CheckDigit('590123412345')).toBe(7);
	});

	it('validates whole codes', () => {
		expect(isValidEan13('4006381333931')).toBe(true);
		expect(isValidEan13('4006381333932')).toBe(false);
		expect(isValidEan13('400638133393')).toBe(false);
		expect(isValidEan13('40063813339a1')).toBe(false);
	});

	it('makes in-store codes that are valid and start in the reserved range', () => {
		for (const id of [1, 42, 9999, 1_234_567]) {
			const code = inStoreBarcode(id);
			expect(code).toHaveLength(13);
			expect(code.startsWith('20')).toBe(true);
			expect(isValidEan13(code)).toBe(true);
		}
		expect(inStoreBarcode(1)).not.toBe(inStoreBarcode(2));
	});

	it('refuses ids that do not fit', () => {
		expect(() => inStoreBarcode(0)).toThrow();
		expect(() => inStoreBarcode(1.5)).toThrow();
		expect(() => inStoreBarcode(10_000_000_000)).toThrow();
		expect(() => ean13CheckDigit('123')).toThrow();
	});
});
