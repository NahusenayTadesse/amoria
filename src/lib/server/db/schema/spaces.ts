import { index, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { birr, jsonText } from './columns';
import { deletionFields, secureFields } from './secureFields';

/**
 * A space Amoria rents out for events: a hall, a garden, a studio (`contentCrud`,
 * `listFields: ['features', 'featuresAm']`). Shown at `/spaces/[slug]` with its photos and video.
 * Booking is by enquiry (chat or phone), so there is no price engine here: `price` is a "from"
 * figure and `priceUnit` says what it buys ("per day", "per event").
 */
export const rentalSpace = mysqlTable('rental_space', {
	id: int('id').autoincrement().primaryKey(),
	slug: varchar('slug', { length: 160 }).notNull().unique(),
	name: varchar('name', { length: 160 }).notNull(),
	nameAm: varchar('name_am', { length: 160 }),
	summary: text('summary'),
	summaryAm: text('summary_am'),
	description: text('description'),
	descriptionAm: text('description_am'),
	/** What comes with it, one item per line: "Sound system", "Parking for 30 cars". */
	features: jsonText('features'),
	featuresAm: jsonText('features_am'),
	/** Guests it seats or holds. `NULL`: not said. */
	capacity: int('capacity'),
	/** Free text such as "250 m²" or "Indoor, ground floor". */
	sizeText: varchar('size_text', { length: 80 }),
	/** The starting price, shown as "from". `NULL`: "ask for a price". */
	price: birr('price'),
	priceUnit: varchar('price_unit', { length: 40 }),
	priceUnitAm: varchar('price_unit_am', { length: 40 }),
	/** A YouTube link as pasted (watch, youtu.be or Shorts); the page draws the kit's player. */
	youtubeUrl: varchar('youtube_url', { length: 255 }),
	sortOrder: int('sort_order').notNull().default(0),
	...secureFields
});

/** A space's gallery, one row per photo (`childCrud`, owner `spaceId`). */
export const rentalSpaceImage = mysqlTable(
	'rental_space_image',
	{
		id: int('id').autoincrement().primaryKey(),
		spaceId: int('space_id')
			.notNull()
			.references(() => rentalSpace.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 64 }).notNull(),
		alt: varchar('alt', { length: 160 }),
		altAm: varchar('alt_am', { length: 160 }),
		sortOrder: int('sort_order').notNull().default(0),
		...deletionFields
	},
	(table) => [index('rental_space_image_owner_idx').on(table.spaceId, table.sortOrder)]
);
