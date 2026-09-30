import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES } from './constants';
import {
	HOLDS_STOCK,
	ORDER_ACTION_LABELS,
	ORDER_STATUS_LABELS,
	ORDER_TRANSITIONS,
	PAID
} from './orderStatus';

describe('the order status table', () => {
	it('covers every status, with a label for each', () => {
		expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
		expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
	});

	it('never lets staff mark an order paid by hand — only a verified payment does that', () => {
		for (const next of Object.values(ORDER_TRANSITIONS)) expect(next).not.toContain('paid');
	});

	it('treats completed, cancelled and expired as final', () => {
		expect(ORDER_TRANSITIONS.completed).toEqual([]);
		expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
		expect(ORDER_TRANSITIONS.expired).toEqual([]);
	});

	it('has a button label for every status staff can move an order to', () => {
		const targets = new Set(Object.values(ORDER_TRANSITIONS).flat());
		for (const target of targets) expect(ORDER_ACTION_LABELS[target]).toBeTruthy();
	});

	it('says an unpaid order cannot skip straight to handed over', () => {
		expect(ORDER_TRANSITIONS.pending_payment).toEqual(['cancelled']);
	});

	it('keeps the stock and money lists consistent', () => {
		// An order holding stock is either waiting for payment or paid and not yet handed over.
		expect(HOLDS_STOCK).toEqual(['pending_payment', 'paid', 'preparing', 'ready']);
		expect(PAID).not.toContain('pending_payment');
		expect(PAID).toContain('paid_unfulfillable');
	});
});
