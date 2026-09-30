import { and, asc, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { localDayRange, localToday } from '@nahu/admin-kit/time';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import { orders, payment, product, registration } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/services/settings';

/**
 * The "Today" board (§10), starting with the gift shop: what needs someone now, and how today is
 * going. Each number is only computed for staff allowed to open the list it points to.
 */
export const load = async ({ locals }) => {
	const canOrders = hasPermission(locals, 'orders.view');
	const canStock = hasPermission(locals, 'stock.view');
	const canSchool = hasPermission(locals, 'school.manage');
	const { start, end } = localDayRange(localToday());
	const { lowStockDefault } = await getSettings();

	const [toHandOver, receipts, [paidToday], lowStock, studentReceipts, [noSeat]] =
		await Promise.all([
			canOrders
				? db
						.select({ status: orders.status, n: count() })
						.from(orders)
						.where(inArray(orders.status, ['paid', 'preparing', 'ready', 'paid_unfulfillable']))
						.groupBy(orders.status)
				: [],
			canOrders
				? db
						.select({
							orderId: orders.id,
							ref: orders.ref,
							name: orders.contactName,
							amount: payment.amount,
							createdAt: payment.createdAt
						})
						.from(payment)
						.innerJoin(orders, eq(orders.id, payment.orderId))
						.where(and(eq(payment.provider, 'bank_transfer'), eq(payment.status, 'initiated')))
						.orderBy(asc(payment.id))
						.limit(10)
				: [],
			canOrders
				? db
						.select({ n: count(), total: sql<string>`COALESCE(SUM(${orders.total}), 0)` })
						.from(orders)
						.where(and(gte(orders.paidAt, start), lt(orders.paidAt, end)))
				: [{ n: 0, total: '0' }],
			canStock
				? db
						.select({ id: product.id, name: product.name, stockQty: product.stockQty })
						.from(product)
						.where(
							and(
								notDeleted(product),
								eq(product.isActive, true),
								sql`${product.stockQty} <= COALESCE(${product.lowStockThreshold}, ${lowStockDefault})`
							)
						)
						.orderBy(asc(product.stockQty), desc(product.isFeatured))
						.limit(10)
				: [],
			canSchool
				? db
						.select({
							registrationId: registration.id,
							ref: registration.ref,
							name: registration.contactName,
							amount: payment.amount,
							createdAt: payment.createdAt
						})
						.from(payment)
						.innerJoin(registration, eq(registration.id, payment.registrationId))
						.where(and(eq(payment.provider, 'bank_transfer'), eq(payment.status, 'initiated')))
						.orderBy(asc(payment.id))
						.limit(10)
				: [],
			canSchool
				? db
						.select({ n: count() })
						.from(registration)
						.where(eq(registration.status, 'paid_unfulfillable'))
				: [{ n: 0 }]
		]);

	const handOver = toHandOver.reduce((sum, row) => sum + row.n, 0);

	return {
		canOrders,
		canStock,
		canSchool,
		stats: [
			...(canOrders
				? [
						{
							key: 'handOver',
							label: 'Orders to hand over',
							value: handOver,
							format: 'count' as const,
							group: 'today',
							hint: 'Paid, not yet collected or delivered',
							tone: handOver ? ('warning' as const) : ('neutral' as const)
						},
						{
							key: 'receipts',
							label: 'Receipts to check',
							value: receipts.length,
							format: 'count' as const,
							group: 'today',
							hint: 'Bank transfers waiting for you',
							tone: receipts.length ? ('warning' as const) : ('neutral' as const)
						},
						{
							key: 'paidToday',
							label: 'Paid today',
							value: Number(paidToday.total),
							format: 'money' as const,
							group: 'today',
							hint: `${paidToday.n} order${paidToday.n === 1 ? '' : 's'}`,
							tone: 'positive' as const
						}
					]
				: []),
			...(canSchool
				? [
						{
							key: 'studentReceipts',
							label: 'Student receipts to check',
							value: studentReceipts.length,
							format: 'count' as const,
							group: 'today',
							hint: noSeat.n ? `${noSeat.n} paid with no seat` : 'Bank transfers for the school',
							tone: studentReceipts.length || noSeat.n ? ('warning' as const) : ('neutral' as const)
						}
					]
				: []),
			...(canStock
				? [
						{
							key: 'low',
							label: 'Low or out of stock',
							value: lowStock.length,
							format: 'count' as const,
							group: 'today',
							hint: 'At or under the warning level',
							tone: lowStock.length ? ('negative' as const) : ('neutral' as const)
						}
					]
				: [])
		],
		receipts,
		studentReceipts,
		lowStock
	};
};
