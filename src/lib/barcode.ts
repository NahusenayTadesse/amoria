/**
 * EAN-13 arithmetic, free of the database. In-store barcodes (for products with none of their own)
 * are `20` + the product id padded to ten digits + the check digit: `20` is the range EAN reserves
 * for a shop's internal use, so they can never clash with a manufacturer's code.
 */

/** The check digit for the first twelve digits of an EAN-13. */
export function ean13CheckDigit(first12: string): number {
	if (!/^\d{12}$/.test(first12)) throw new Error('An EAN-13 starts from twelve digits.');
	const sum = [...first12].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
	return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
	return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** The in-store code for a product id. */
export function inStoreBarcode(productId: number): string {
	if (!Number.isInteger(productId) || productId < 1 || productId > 9_999_999_999) {
		throw new Error('A product id has at most ten digits.');
	}
	const first12 = `20${String(productId).padStart(10, '0')}`;
	return `${first12}${ean13CheckDigit(first12)}`;
}
