import {
	date,
	datetime,
	foreignKey,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import {
	ADJUSTMENT_REASONS,
	DOCUMENT_STATUSES,
	DOCUMENT_TYPES,
	LOT_STATUSES,
	STOCK_REASONS
} from '../../../constants';
import { user } from './auth';
import { product } from './catalog';
import { birr, percent, unitCost } from './columns';
import { customer } from './customers';
import { location } from './locations';
import { posShift } from './pos';
import { purchaseOrder, purchaseOrderLine } from './purchasing';
import { requisition } from './requisitions';
import { deletionFields } from './secureFields';
import { supplier } from './suppliers';

/**
 * One batch of one product, as printed on the pack: lot number and expiry date. Only products with
 * `trackLots` have them.
 *
 * Whether a lot is *expired* is read off `expiryDate` against today, never stored: a status column
 * would need a job to flip it at midnight, and a missed run would let expired stock be sold.
 * `status` holds only what a person decides: pulled off the shelf, or named in a recall.
 */
export const stockLot = mysqlTable(
	'stock_lot',
	{
		id: int('id').autoincrement().primaryKey(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		lotNumber: varchar('lot_number', { length: 60 }).notNull(),
		/** A calendar day (`YYYY-MM-DD`), never shifted through a time zone. */
		expiryDate: date('expiry_date', { mode: 'string' }),
		status: mysqlEnum('status', LOT_STATUSES).notNull().default('available'),
		/** Who delivered this batch: what a recall is traced back to. */
		supplierId: int('supplier_id').references(() => supplier.id, { onDelete: 'restrict' }),
		note: varchar('note', { length: 255 }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('stock_lot_product_number_idx').on(table.productId, table.lotNumber),
		index('stock_lot_expiry_idx').on(table.expiryDate)
	]
);

/**
 * What is on hand, per location, product and lot. A cache of `stock_movement`, written only by the
 * ledger in the same transaction as the movements it sums.
 *
 * `lotKey` is `lotId` or 0. It exists because MySQL lets a unique index hold any number of rows
 * whose key column is NULL, so (location, product, NULL) could not be kept to one row otherwise.
 */
export const stockBalance = mysqlTable(
	'stock_balance',
	{
		id: int('id').autoincrement().primaryKey(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		lotId: int('lot_id').references(() => stockLot.id, { onDelete: 'restrict' }),
		lotKey: int('lot_key').notNull().default(0),
		quantity: int('quantity').notNull().default(0),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [
		uniqueIndex('stock_balance_key_idx').on(table.locationId, table.productId, table.lotKey),
		index('stock_balance_product_idx').on(table.productId)
	]
);

/**
 * A stock document: the paper a storekeeper fills in. Drafted, then posted.
 *
 * Posting is the only thing that changes stock through a document (`services/inventory/post`). A
 * posted document is never edited; a mistake is corrected by another document, so the ledger
 * always explains itself. Never deleted (§5.0): a draft that is dropped ends `cancelled`.
 *
 * A till sale is an `issue` with priced lines and a `shiftId`; its money is in `pos_payment`.
 */
export const stockDocument = mysqlTable(
	'stock_document',
	{
		id: int('id').autoincrement().primaryKey(),
		type: mysqlEnum('type', DOCUMENT_TYPES).notNull(),
		status: mysqlEnum('status', DOCUMENT_STATUSES).notNull().default('draft'),
		/** Given when posted, e.g. `AM-GRN-2019-00042`. Drafts have none, so no numbers are skipped. */
		number: varchar('number', { length: 40 }).unique(),
		docDate: date('doc_date', { mode: 'string' }).notNull(),
		/** Where stock leaves from: issues, transfers, adjustments, supplier returns. */
		fromLocationId: int('from_location_id').references(() => location.id, {
			onDelete: 'restrict'
		}),
		/** Where stock arrives: receipts, transfers, customer returns. */
		toLocationId: int('to_location_id').references(() => location.id, { onDelete: 'restrict' }),
		/** The supplier's invoice or delivery note number. */
		reference: varchar('reference', { length: 80 }),
		/** Receipts and supplier returns: who. Required to post a receipt. */
		supplierId: int('supplier_id').references(() => supplier.id, { onDelete: 'restrict' }),
		/** Issues: who it went to, as written on the paper (a décor team, a class). */
		party: varchar('party', { length: 160 }),
		/** Sales: the customer, when they are on the customer list. Optional. */
		customerId: int('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		reason: mysqlEnum('reason', ADJUSTMENT_REASONS),
		note: text('note'),
		/** Receipts: the purchase order this delivery is against. */
		purchaseOrderId: int('purchase_order_id').references((): AnyMySqlColumn => purchaseOrder.id, {
			onDelete: 'restrict'
		}),
		/** Issues: the requisition this fills. */
		requisitionId: int('requisition_id').references((): AnyMySqlColumn => requisition.id, {
			onDelete: 'set null'
		}),
		/** Till sales: the shift it was rung up in. */
		shiftId: int('shift_id').references((): AnyMySqlColumn => posShift.id, {
			onDelete: 'restrict'
		}),
		/** Returns: the sale or delivery being returned. */
		returnOfId: int('return_of_id').references((): AnyMySqlColumn => stockDocument.id, {
			onDelete: 'restrict'
		}),
		/** Sales, worked out when posted (`roundBirr`): before VAT, the VAT, and what was charged. */
		subtotal: birr('subtotal'),
		vatTotal: birr('vat_total'),
		total: birr('total'),
		postedAt: datetime('posted_at'),
		postedBy: varchar('posted_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
			.notNull()
	},
	(table) => [
		index('stock_document_status_idx').on(table.status, table.type),
		index('stock_document_date_idx').on(table.docDate),
		index('stock_document_shift_idx').on(table.shiftId)
	]
);

/**
 * One line of a document, as entered. Quantities are whole units (`product.unit` is a label).
 * Signed only on adjustments, where the sign says add or remove.
 */
export const stockDocumentLine = mysqlTable(
	'stock_document_line',
	{
		id: int('id').autoincrement().primaryKey(),
		documentId: int('document_id')
			.notNull()
			.references(() => stockDocument.id, { onDelete: 'restrict' }),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		quantity: int('quantity').notNull(),
		/** Receipts and positive adjustments. Empty means the product's average cost. */
		unitCost: unitCost('unit_cost'),
		/** Sales: what one unit was charged, VAT included when the shop's prices include it. */
		unitPrice: birr('unit_price'),
		/** The price before a discount, when the line was discounted. */
		listPrice: birr('list_price'),
		/** VAT on this line in percent, fixed when the document is posted. */
		vatRate: percent('vat_rate'),
		/** Issues and transfers: take from this lot. Empty means first expiry first out. */
		lotId: int('lot_id').references(() => stockLot.id, { onDelete: 'restrict' }),
		/** Receipts and positive adjustments: the lot being brought in. */
		lotNumber: varchar('lot_number', { length: 60 }),
		expiryDate: date('expiry_date', { mode: 'string' }),
		/** Returns: the line of the original document this returns part of. */
		returnOfLineId: int('return_of_line_id').references(
			(): AnyMySqlColumn => stockDocumentLine.id,
			{ onDelete: 'restrict' }
		),
		/** The order line this receipt line delivers. */
		purchaseOrderLineId: int('purchase_order_line_id'),
		note: varchar('note', { length: 255 }),
		// Soft delete, so the kit's `childCrud` can manage a draft's lines. Soft-deleted rows are
		// purged when the document is posted (`postInTx`): a posted document has none.
		...deletionFields
	},
	(table) => [
		index('stock_document_line_doc_idx').on(table.documentId),
		index('stock_document_line_product_idx').on(table.productId),
		// Named by hand: the generated name is over MySQL's 64-character limit.
		foreignKey({
			name: 'stock_document_line_po_line_fk',
			columns: [table.purchaseOrderLineId],
			foreignColumns: [purchaseOrderLine.id]
		}).onDelete('restrict')
	]
);

/**
 * The stock ledger. Append-only: one row per change to a quantity at a location, written by the
 * ledger in the same transaction as the balance update, with the product row locked.
 *
 * `delta` is signed (in positive, out negative). `unitCost` is what the stock was valued at then,
 * so cost of goods and stock value can be rebuilt from this table alone. `refType`/`refId` name
 * what caused it (`order`, `document`, …), a polymorphic pointer so no foreign key; documents
 * also set `documentId`.
 */
export const stockMovement = mysqlTable(
	'stock_movement',
	{
		id: int('id').autoincrement().primaryKey(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		lotId: int('lot_id').references(() => stockLot.id, { onDelete: 'restrict' }),
		/** Signed: positive in, negative out. */
		delta: int('delta').notNull(),
		reason: mysqlEnum('reason', STOCK_REASONS).notNull(),
		/** Per unit, at the time of the movement: what the stock was valued at. */
		unitCost: unitCost('unit_cost').notNull().default(0),
		documentId: int('document_id').references(() => stockDocument.id, { onDelete: 'restrict' }),
		refType: varchar('ref_type', { length: 20 }),
		refId: int('ref_id'),
		/** The Addis Ababa business day, so reports group by day without time-zone sums. */
		docDate: date('doc_date', { mode: 'string' }).notNull(),
		note: varchar('note', { length: 255 }),
		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(table) => [
		index('stock_movement_product_idx').on(table.productId, table.createdAt),
		index('stock_movement_ref_idx').on(table.refType, table.refId),
		index('stock_movement_location_idx').on(table.locationId, table.productId),
		index('stock_movement_document_idx').on(table.documentId),
		index('stock_movement_date_idx').on(table.docDate)
	]
);

/**
 * The last number issued per document type and Ethiopian fiscal year. Locked with `FOR UPDATE`
 * while a document is posted, so two storekeepers posting at once cannot draw the same number.
 */
export const numberSequence = mysqlTable(
	'number_sequence',
	{
		id: int('id').autoincrement().primaryKey(),
		docType: varchar('doc_type', { length: 20 }).notNull(),
		fiscalYear: int('fiscal_year').notNull(),
		lastNumber: int('last_number').notNull().default(0)
	},
	(table) => [uniqueIndex('number_sequence_key_idx').on(table.docType, table.fiscalYear)]
);

/**
 * How much of a product a location should hold: at or below `minQuantity` it needs reordering, up
 * to `maxQuantity`. Products without a rule fall back to their own low-stock threshold.
 */
export const reorderRule = mysqlTable(
	'reorder_rule',
	{
		id: int('id').autoincrement().primaryKey(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		minQuantity: int('min_quantity').notNull(),
		maxQuantity: int('max_quantity'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('reorder_rule_key_idx').on(table.locationId, table.productId)]
);
