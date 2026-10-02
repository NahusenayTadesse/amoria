/**
 * The till at the Mekanisa shop. A till sale is an ordinary sale — a posted `issue` with priced
 * lines (`post.ts`) — made in one step: the lines, the posting and the payments all in one
 * transaction, so the stock, the VAT and the drawer always agree.
 *
 * A cashier opens a shift with a float and closes it by counting the drawer against
 * float + cash taken − cash paid out; the difference is recorded, not hidden. Payment may be split
 * across methods, and only cash gives change. There is no credit: a sale is paid in full when it is
 * rung up.
 */
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '$lib/server/db';
import { transaction } from '$lib/server/db/retry';
import { invalidate } from '$lib/server/cache';
import {
	category,
	location,
	posPayment,
	posShift,
	product,
	stockBalance,
	stockDocument,
	stockDocumentLine,
	user
} from '$lib/server/db/schema';
import type { POS_METHODS } from '$lib/constants';
import { roundBirr, sumBirr } from '$lib/money';
import { vatWithin } from '$lib/stockMath';
import type { Actor } from '../payments/payable';
import { getSettings } from '../settings';
import { saveDocumentInTx } from './documents';
import { defaultPlace, places } from './ledger';
import { postInTx } from './post';

type Method = (typeof POS_METHODS)[number];

const MAX_LINES = 60;

// ── Shifts ──────────────────────────────────────────────────────────────────────────────────

export async function currentShift(userId: string, reader: Writer = db) {
	const [row] = await reader
		.select({ shift: posShift, location: location.name })
		.from(posShift)
		.innerJoin(location, eq(location.id, posShift.locationId))
		.where(and(eq(posShift.openedBy, userId), eq(posShift.status, 'open')))
		.orderBy(desc(posShift.id))
		.limit(1);
	return row ? { ...row.shift, location: row.location } : null;
}

/** Opens a shift for a cashier, selling from the shop floor unless another location is named. */
export async function openShift(
	input: { floatAmount: number; locationId?: number },
	actor: Actor
): Promise<number> {
	const userId = actor.locals.user?.id;
	if (!userId) throw new WriteRefused(null, 'Sign in to open a till.');
	return transaction(async (tx) => {
		if (await currentShift(userId, tx)) {
			throw new WriteRefused(null, 'You already have a till open. Close it first.');
		}
		if (!(input.floatAmount >= 0)) {
			throw new WriteRefused('floatAmount', 'The float cannot be negative.');
		}
		const list = await places(tx);
		const chosen = input.locationId
			? list.find((p) => p.id === input.locationId)
			: defaultPlace(list);
		if (!chosen || chosen.kind === 'quarantine') {
			throw new WriteRefused('locationId', 'Choose where this till sells from.');
		}
		return insertReturningId(tx, posShift, {
			locationId: chosen.id,
			openedBy: userId,
			floatAmount: roundBirr(input.floatAmount)
		});
	});
}

/**
 * What a shift took by payment method, and what the drawer should hold: the float, plus cash
 * taken, less cash paid out on refunds.
 */
export async function shiftSummary(shiftId: number, reader: Writer = db) {
	const [row] = await reader
		.select({ shift: posShift, cashier: user.name, location: location.name })
		.from(posShift)
		.innerJoin(location, eq(location.id, posShift.locationId))
		.leftJoin(user, eq(user.id, posShift.openedBy))
		.where(eq(posShift.id, shiftId));
	if (!row) throw new WriteRefused(null, 'That shift does not exist.');

	const byMethod = await reader
		.select({
			method: posPayment.method,
			taken: sql<number>`SUM(CASE WHEN ${posPayment.amount} > 0 THEN ${posPayment.amount} ELSE 0 END)`,
			paidOut: sql<number>`SUM(CASE WHEN ${posPayment.amount} < 0 THEN -${posPayment.amount} ELSE 0 END)`,
			count: sql<number>`COUNT(*)`
		})
		.from(posPayment)
		.where(eq(posPayment.shiftId, shiftId))
		.groupBy(posPayment.method);
	const [{ sales }] = await reader
		.select({ sales: sql<number>`COUNT(*)` })
		.from(stockDocument)
		.where(
			and(
				eq(stockDocument.shiftId, shiftId),
				eq(stockDocument.type, 'issue'),
				eq(stockDocument.status, 'posted')
			)
		);

	const methods = byMethod.map((m) => ({
		method: m.method,
		taken: roundBirr(Number(m.taken)),
		paidOut: roundBirr(Number(m.paidOut)),
		count: Number(m.count)
	}));
	const cash = methods.find((m) => m.method === 'cash');
	return {
		shift: row.shift,
		cashier: row.cashier,
		location: row.location,
		sales: Number(sales),
		takenTotal: sumBirr(methods.map((m) => m.taken - m.paidOut)),
		methods,
		expectedCash: roundBirr(row.shift.floatAmount + (cash ? cash.taken - cash.paidOut : 0))
	};
}

/** Counts the drawer and closes the shift. The difference from what it should hold is kept. */
export async function closeShift(
	shiftId: number,
	input: { countedCash: number; note?: string | null },
	actor: Actor
) {
	if (!(input.countedCash >= 0)) {
		throw new WriteRefused('countedCash', 'Enter the cash you counted, zero or more.');
	}
	return transaction(async (tx) => {
		const [shift] = await tx.select().from(posShift).where(eq(posShift.id, shiftId)).for('update');
		if (!shift) throw new WriteRefused(null, 'That shift does not exist.');
		if (shift.status !== 'open') throw new WriteRefused(null, 'That shift is already closed.');
		const me = actor.locals.user?.id ?? null;
		if (shift.openedBy && me && shift.openedBy !== me && !actor.locals.isSuperAdmin) {
			throw new WriteRefused(null, 'Only the cashier who opened this till can close it.');
		}
		const summary = await shiftSummary(shiftId, tx);
		const counted = roundBirr(input.countedCash);
		await tx
			.update(posShift)
			.set({
				status: 'closed',
				closedBy: me,
				closedAt: new Date(),
				expectedCash: summary.expectedCash,
				countedCash: counted,
				note: input.note?.trim() || null
			})
			.where(eq(posShift.id, shiftId));
		await recordAudit(tx, actor, {
			table: 'pos_shift',
			recordId: shiftId,
			action: 'update',
			before: { status: 'open' },
			after: { status: 'closed' },
			detail: {
				expected: summary.expectedCash,
				counted,
				difference: roundBirr(counted - summary.expectedCash)
			}
		});
		return {
			expected: summary.expectedCash,
			counted,
			difference: roundBirr(counted - summary.expectedCash)
		};
	});
}

// ── Finding products ────────────────────────────────────────────────────────────────────────

/**
 * Products the till can sell, for the search box: an exact barcode or SKU first, then names. Each
 * comes with what the shop floor holds, which is all the till can sell.
 */
export async function searchProducts(query: string, locationId: number, limit = 20) {
	const q = query.trim();
	if (!q) return [];
	const held = sql<number>`COALESCE((SELECT SUM(${stockBalance.quantity}) FROM ${stockBalance} WHERE ${stockBalance.productId} = ${product.id} AND ${stockBalance.locationId} = ${locationId}), 0)`;
	const rows = await db
		.select({
			id: product.id,
			name: product.name,
			nameAm: product.nameAm,
			sku: product.sku,
			barcode: product.barcode,
			price: product.price,
			unit: product.unit,
			category: category.name,
			onFloor: held
		})
		.from(product)
		.leftJoin(category, eq(category.id, product.categoryId))
		.where(
			and(
				sql`${product.deletedAt} IS NULL`,
				eq(product.isActive, true),
				eq(product.kind, 'gift'),
				sql`${product.price} IS NOT NULL`,
				or(
					eq(product.barcode, q),
					eq(product.sku, q),
					like(product.name, `%${q}%`),
					like(product.nameAm, `%${q}%`)
				)
			)
		)
		.orderBy(sql`(${product.barcode} = ${q} OR ${product.sku} = ${q}) DESC`, asc(product.name))
		.limit(limit);
	return rows.map((r) => ({ ...r, price: r.price!, onFloor: Number(r.onFloor) }));
}

// ── Selling ─────────────────────────────────────────────────────────────────────────────────

export type TillLine = { productId: number; quantity: number; unitPrice?: number };
export type TillPayment = { method: Method; amount: number; reference?: string | null };

/**
 * Rings up a sale: drafts and posts the issue, prices it (VAT fixed on the lines), and records the
 * payments, in one transaction. Cash may be more than the total, and the excess is the change;
 * other methods must not exceed what is left after cash. Any price other than the shelf price needs
 * `canDiscount`. Returns what the screen and the receipt need.
 */
export async function checkout(
	input: {
		lines: TillLine[];
		payments: TillPayment[];
		customerId?: number | null;
		note?: string | null;
		canDiscount?: boolean;
	},
	actor: Actor
) {
	const userId = actor.locals.user?.id;
	if (!userId) throw new WriteRefused(null, 'Sign in to use the till.');
	if (!input.lines.length) throw new WriteRefused(null, 'The basket is empty.');
	if (input.lines.length > MAX_LINES) {
		throw new WriteRefused(null, `A sale has at most ${MAX_LINES} lines. Ring it up in two parts.`);
	}
	for (const l of input.lines) {
		if (!Number.isInteger(l.quantity) || l.quantity < 1) {
			throw new WriteRefused(null, 'Every quantity is a whole number of at least 1.');
		}
		if (l.unitPrice !== undefined && !(l.unitPrice >= 0)) {
			throw new WriteRefused(null, 'A price cannot be negative.');
		}
	}
	if (input.payments.some((p) => !(p.amount > 0))) {
		throw new WriteRefused(null, 'Every payment is an amount above zero.');
	}

	const settings = await getSettings();
	const result = await transaction(async (tx) => {
		const shift = await currentShift(userId, tx);
		if (!shift) throw new WriteRefused(null, 'Open your till first.');

		const ids = [...new Set(input.lines.map((l) => l.productId))].sort((a, b) => a - b);
		const rows = await tx
			.select({
				id: product.id,
				name: product.name,
				kind: product.kind,
				price: product.price,
				isActive: product.isActive
			})
			.from(product)
			.where(
				and(
					sql`${product.id} IN (${sql.join(
						ids.map((i) => sql`${i}`),
						sql`, `
					)})`,
					sql`${product.deletedAt} IS NULL`
				)
			);
		const byId = new Map(rows.map((r) => [r.id, r]));

		const lines = input.lines.map((l) => {
			const p = byId.get(l.productId);
			if (!p || !p.isActive)
				throw new WriteRefused(null, 'A product in the basket is no longer sold.');
			if (p.kind !== 'gift' || p.price == null) {
				throw new WriteRefused(null, `${p.name} is not sold at the till.`);
			}
			const unitPrice = roundBirr(l.unitPrice ?? p.price);
			// The shelf price is the price. Changing it, up or down, is a privilege.
			if (unitPrice !== p.price && !input.canDiscount) {
				throw new WriteRefused(
					null,
					`${p.name}: the price is ETB ${p.price}. Changing it needs permission to set prices at the till.`
				);
			}
			return { productId: p.id, quantity: l.quantity, unitPrice, listPrice: p.price };
		});

		const documentId = await saveDocumentInTx(
			tx,
			{
				header: {
					type: 'issue',
					docDate: localToday(),
					fromLocationId: shift.locationId,
					shiftId: shift.id,
					customerId: input.customerId ?? null,
					party: 'Till sale',
					note: input.note?.trim() || null
				},
				lines
			},
			actor
		);
		const posted = await postInTx(tx, documentId, actor, settings);
		const total = posted.total ?? 0;

		// Payment: cash may be over (the change); every other method is exact.
		const cash = roundBirr(
			sumBirr(input.payments.filter((p) => p.method === 'cash').map((p) => p.amount))
		);
		const other = roundBirr(
			sumBirr(input.payments.filter((p) => p.method !== 'cash').map((p) => p.amount))
		);
		if (other > total) {
			throw new WriteRefused(
				null,
				'Only cash gives change. Lower the other payments to the total.'
			);
		}
		const paid = roundBirr(cash + other);
		if (paid < total) {
			throw new WriteRefused(
				null,
				`ETB ${roundBirr(total - paid).toFixed(2)} is still to pay. There is no credit at the till.`
			);
		}
		const change = roundBirr(paid - total);
		if (change > cash) {
			throw new WriteRefused(
				null,
				'Only cash gives change. Lower the other payments to the total.'
			);
		}

		// The cash line keeps what the sale keeps: what was handed over, less the change.
		let changeLeft = change;
		const rowsToWrite = input.payments.map((p) => {
			let amount = roundBirr(p.amount);
			if (p.method === 'cash' && changeLeft > 0) {
				const take = Math.min(amount, changeLeft);
				amount = roundBirr(amount - take);
				changeLeft = roundBirr(changeLeft - take);
			}
			return { p, amount };
		});
		for (const { p, amount } of rowsToWrite) {
			if (amount <= 0) continue;
			await tx.insert(posPayment).values({
				documentId,
				shiftId: shift.id,
				method: p.method,
				amount,
				reference: p.reference?.trim() || null
			});
		}
		return { documentId, number: posted.number, total, change };
	});
	invalidate('catalog');
	return result;
}

/**
 * A customer brings back part of a till sale: the goods go back on the shelf (into the lots they
 * left from), and the refund is paid out of the drawer (or by the method they paid with). Refuses
 * anything not sold at a till, and more than was sold.
 */
export async function returnAtTill(
	input: {
		originalId: number;
		lines: { lineId: number; quantity: number }[];
		method?: Method;
		reference?: string | null;
	},
	actor: Actor
) {
	const userId = actor.locals.user?.id;
	if (!userId) throw new WriteRefused(null, 'Sign in to use the till.');
	const wanted = input.lines.filter((l) => l.quantity > 0);
	if (!wanted.length) throw new WriteRefused(null, 'Choose what is coming back.');

	const settings = await getSettings();
	const result = await transaction(async (tx) => {
		const shift = await currentShift(userId, tx);
		if (!shift) throw new WriteRefused(null, 'Open your till first.');

		const [orig] = await tx
			.select()
			.from(stockDocument)
			.where(eq(stockDocument.id, input.originalId));
		if (!orig || orig.type !== 'issue' || orig.status !== 'posted' || !orig.shiftId) {
			throw new WriteRefused(null, 'Only a posted till sale can be returned here.');
		}
		const origLines = await tx
			.select()
			.from(stockDocumentLine)
			.where(eq(stockDocumentLine.documentId, orig.id));
		const lineById = new Map(origLines.map((l) => [l.id, l]));

		let refund = 0;
		let vat = 0;
		const lines = wanted.map((w) => {
			const line = lineById.get(w.lineId);
			if (!line) throw new WriteRefused(null, 'That is not a line of the sale being returned.');
			const amount = roundBirr(line.unitPrice! * w.quantity);
			refund += amount;
			if (line.vatRate) {
				vat += settings.pricesIncludeVat
					? roundBirr(vatWithin(amount, line.vatRate))
					: roundBirr((amount * line.vatRate) / 100);
			}
			return {
				productId: line.productId,
				quantity: w.quantity,
				unitPrice: line.unitPrice,
				returnOfLineId: line.id
			};
		});
		refund = roundBirr(refund);

		const documentId = await saveDocumentInTx(
			tx,
			{
				header: {
					type: 'sales_return',
					docDate: localToday(),
					toLocationId: shift.locationId,
					shiftId: shift.id,
					returnOfId: orig.id,
					customerId: orig.customerId,
					reference: orig.number
				},
				lines
			},
			actor
		);
		const posted = await postInTx(tx, documentId, actor, settings);
		const vatTotal = roundBirr(vat);
		await tx
			.update(stockDocument)
			.set({
				total: refund,
				vatTotal,
				subtotal: settings.pricesIncludeVat
					? roundBirr(refund - vatTotal)
					: roundBirr(refund - vatTotal)
			})
			.where(eq(stockDocument.id, documentId));
		await tx.insert(posPayment).values({
			documentId,
			shiftId: shift.id,
			method: input.method ?? 'cash',
			amount: -refund,
			reference: input.reference?.trim() || null
		});
		return { documentId, number: posted.number, refund };
	});
	invalidate('catalog');
	return result;
}

// ── Receipts ────────────────────────────────────────────────────────────────────────────────

/** Everything a printed till receipt (or a refund slip) shows. */
export async function receiptView(documentId: number) {
	const [doc] = await db
		.select({
			id: stockDocument.id,
			type: stockDocument.type,
			number: stockDocument.number,
			postedAt: stockDocument.postedAt,
			docDate: stockDocument.docDate,
			subtotal: stockDocument.subtotal,
			vatTotal: stockDocument.vatTotal,
			total: stockDocument.total,
			reference: stockDocument.reference,
			cashier: user.name
		})
		.from(stockDocument)
		.leftJoin(user, eq(user.id, stockDocument.postedBy))
		.where(and(eq(stockDocument.id, documentId), eq(stockDocument.status, 'posted')));
	if (!doc || !['issue', 'sales_return'].includes(doc.type)) return null;

	const [lines, payments, settings] = await Promise.all([
		db
			.select({
				id: stockDocumentLine.id,
				name: product.name,
				quantity: stockDocumentLine.quantity,
				unitPrice: stockDocumentLine.unitPrice,
				listPrice: stockDocumentLine.listPrice,
				vatRate: stockDocumentLine.vatRate
			})
			.from(stockDocumentLine)
			.innerJoin(product, eq(product.id, stockDocumentLine.productId))
			.where(eq(stockDocumentLine.documentId, documentId))
			.orderBy(asc(stockDocumentLine.id)),
		db
			.select({
				method: posPayment.method,
				amount: posPayment.amount,
				reference: posPayment.reference
			})
			.from(posPayment)
			.where(eq(posPayment.documentId, documentId))
			.orderBy(asc(posPayment.id)),
		getSettings()
	]);
	return {
		doc,
		lines: lines.map((l) => ({
			...l,
			lineTotal: roundBirr((l.unitPrice ?? 0) * l.quantity)
		})),
		payments,
		vatRegistered: settings.vatRegistered,
		vatRate: settings.vatRate,
		footer: settings.receiptFooter,
		address: settings.address,
		phone: settings.businessPhone
	};
}
