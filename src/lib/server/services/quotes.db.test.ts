import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '$lib/server/db';
import { auditLog, customer, quoteRequest } from '$lib/server/db/schema';
import { quoteRequestSchema, type QuoteRequestInput } from '$lib/schemas/quote';
import { actorFor, dayFromNow, makeStaff, resetDb } from '$lib/server/testing/db';
import { createQuoteRequest, setQuoteRequestStatus } from './quotes';

beforeEach(resetDb);

const contact = { name: 'Selam', phone: '+251911234567', email: null, locale: 'en' as const };

const input = (overrides: Partial<QuoteRequestInput> = {}): QuoteRequestInput =>
	quoteRequestSchema.parse({ name: 'Selam', phone: '0911234567', ...overrides });

describe('quoteRequestSchema', () => {
	it('needs only the contact details; empty fields mean "not given"', () => {
		const parsed = quoteRequestSchema.parse({
			name: 'Selam',
			phone: '0911234567',
			eventTypeId: '',
			guestCount: '',
			budget: '',
			packageId: ''
		});
		expect(parsed.eventTypeId).toBeUndefined();
		expect(parsed.guestCount).toBeUndefined();
		expect(parsed.preferredChannel).toBe('phone');
	});

	it('reads numbers typed into a form and refuses a bad phone', () => {
		expect(
			quoteRequestSchema.parse({
				name: 'Selam',
				phone: '0911234567',
				guestCount: '120',
				budget: '45000'
			})
		).toMatchObject({ guestCount: 120, budget: 45000 });
		expect(quoteRequestSchema.safeParse({ name: 'Selam', phone: '123' }).success).toBe(false);
	});
});

describe('createQuoteRequest', () => {
	it('saves the request with the customer, as new', async () => {
		const made = await createQuoteRequest(
			input({ eventDate: dayFromNow(30), guestCount: 80, message: 'Garden wedding' }),
			contact
		);
		expect(made.token).toHaveLength(22);

		const [row] = await db.select().from(quoteRequest).where(eq(quoteRequest.id, made.id));
		expect(row).toMatchObject({
			status: 'new',
			contactName: 'Selam',
			contactPhone: '+251911234567',
			guestCount: 80,
			message: 'Garden wedding',
			preferredChannel: 'phone'
		});
		expect(await db.select().from(customer)).toHaveLength(1);
	});

	it('is one request however many times the same clientRef arrives', async () => {
		const first = await createQuoteRequest(input({ clientRef: 'abc-123' }), contact);
		const again = await createQuoteRequest(input({ clientRef: 'abc-123' }), contact);
		expect(again).toMatchObject({ id: first.id, token: first.token, duplicate: true });
		expect(await db.select().from(quoteRequest)).toHaveLength(1);
	});

	it('refuses a date that has already passed', async () => {
		await expect(
			createQuoteRequest(input({ eventDate: dayFromNow(-3) }), contact)
		).rejects.toBeInstanceOf(WriteRefused);
		expect(await db.select().from(quoteRequest)).toHaveLength(0);
	});
});

describe('setQuoteRequestStatus', () => {
	it('moves a request along, assigns it, and records who did it', async () => {
		const { id } = await createQuoteRequest(input(), contact);
		const staff = await makeStaff();

		await setQuoteRequestStatus(id, 'contacted', actorFor(staff), staff);

		const [row] = await db.select().from(quoteRequest).where(eq(quoteRequest.id, id));
		expect(row).toMatchObject({ status: 'contacted', assignedTo: staff });
		const audit = await db.select().from(auditLog);
		expect(audit.some((a) => a.tableName === 'quote_request' && a.recordId === String(id))).toBe(
			true
		);
	});

	it('leaves the assignee alone when none is given, and refuses an unknown request', async () => {
		const { id } = await createQuoteRequest(input(), contact);
		const staff = await makeStaff();
		await setQuoteRequestStatus(id, 'contacted', actorFor(staff), staff);
		await setQuoteRequestStatus(id, 'quoted', actorFor(staff));
		const [row] = await db.select().from(quoteRequest).where(eq(quoteRequest.id, id));
		expect(row).toMatchObject({ status: 'quoted', assignedTo: staff });

		await expect(setQuoteRequestStatus(9999, 'won', actorFor(staff))).rejects.toBeInstanceOf(
			WriteRefused
		);
	});
});
