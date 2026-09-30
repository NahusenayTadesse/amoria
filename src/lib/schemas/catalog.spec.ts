import { describe, expect, it } from 'vitest';
import {
	bankAccountAdd,
	categoryAdd,
	productAdd,
	productEdit,
	shopSettingsSchema
} from './catalog';
import { stockAdjustSchema } from './dashboard';

const gift = { kind: 'gift', categoryId: '3', name: 'Red rose bouquet', price: '1450' };

describe('product form', () => {
	it('needs a price for a gift and a daily rate for rental equipment', () => {
		expect(productAdd.safeParse(gift).success).toBe(true);
		expect(productAdd.safeParse({ ...gift, price: '' }).success).toBe(false);
		expect(productAdd.safeParse({ ...gift, kind: 'rental', price: '' }).success).toBe(false);
		expect(
			productAdd.safeParse({ ...gift, kind: 'rental', price: '', dailyRate: '500' }).success
		).toBe(true);
	});

	it('reads an empty box as "not set", not zero', () => {
		const parsed = productAdd.parse({ ...gift, lowStockThreshold: '' });
		expect(parsed.lowStockThreshold).toBeUndefined();
	});

	it('accepts an edit seeded from a row whose optional columns are null', () => {
		// The edit dialog is filled from the database row, where empty optional columns are null.
		const fromRow = {
			...gift,
			id: 2,
			nameAm: null,
			description: null,
			descriptionAm: null,
			slug: null
		};
		const parsed = productEdit.safeParse(fromRow);
		expect(parsed.success).toBe(true);
		expect(parsed.data).toMatchObject({ nameAm: '', description: '', descriptionAm: '', slug: '' });
	});

	it('only accepts a link name of lowercase letters, digits and dashes', () => {
		expect(productAdd.safeParse({ ...gift, slug: 'Red-Rose' }).data?.slug).toBe('red-rose');
		expect(productAdd.safeParse({ ...gift, slug: 'red rose' }).success).toBe(false);
		expect(productAdd.safeParse({ ...gift, slug: '../admin' }).success).toBe(false);
	});

	it('never takes a stock quantity from the form', () => {
		expect(productAdd.parse({ ...gift, stockQty: '999' })).not.toHaveProperty('stockQty');
	});
});

describe('other catalog forms', () => {
	it('defaults a category to gifts and switched on', () => {
		expect(categoryAdd.parse({ name: 'Flowers' })).toMatchObject({
			kind: 'gift',
			status: true,
			sortOrder: 0
		});
	});

	it('accepts an account number as a customer would type it, nothing else', () => {
		const base = { bankName: 'CBE', accountName: 'Amoria' };
		expect(bankAccountAdd.safeParse({ ...base, accountNumber: '1000 1234 5678' }).success).toBe(
			true
		);
		expect(bankAccountAdd.safeParse({ ...base, accountNumber: '0911234567' }).success).toBe(true);
		expect(bankAccountAdd.safeParse({ ...base, accountNumber: 'ask the shop' }).success).toBe(
			false
		);
	});

	it('keeps the order hold between 5 minutes and a day', () => {
		const base = {
			holdMinutes: 30,
			freeDeliveryThreshold: 3000,
			freeDeliverySuggestAt: 2000,
			lowStockDefault: 3
		};
		expect(shopSettingsSchema.safeParse(base).success).toBe(true);
		expect(shopSettingsSchema.safeParse({ ...base, holdMinutes: 2 }).success).toBe(false);
		expect(shopSettingsSchema.safeParse({ ...base, holdMinutes: 2000 }).success).toBe(false);
		expect(shopSettingsSchema.safeParse({ ...base, freeDeliveryThreshold: -1 }).success).toBe(
			false
		);
	});
});

describe('stock adjust form', () => {
	it('asks how many for a movement, but not for a count', () => {
		expect(stockAdjustSchema.safeParse({ mode: 'move', reason: 'damage', qty: '0' }).success).toBe(
			false
		);
		expect(stockAdjustSchema.safeParse({ mode: 'move', reason: 'damage', qty: '2' }).success).toBe(
			true
		);
		expect(stockAdjustSchema.safeParse({ mode: 'count', counted: '4' }).success).toBe(true);
	});

	it('refuses a negative count and a reason only the system writes', () => {
		expect(stockAdjustSchema.safeParse({ mode: 'count', counted: '-1' }).success).toBe(false);
		expect(stockAdjustSchema.safeParse({ mode: 'move', reason: 'sale', qty: '1' }).success).toBe(
			false
		);
	});
});
