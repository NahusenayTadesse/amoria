-- DEVELOPMENT ONLY: demo renters for the rental marketplace (§5.12), Amoria's own rental listing
-- profile and its event spaces. Not real businesses, TINs, licences or bank accounts. Never run
-- against the production database. The sign-ins are listed in accounts.md.
--
--   bash scripts/demo-images.sh        # once: the demo-rent-*, demo-renter-*, demo-space-* photos
--   mariadb -u dev amoria < scripts/seed-dev-renters.sql
--
-- Needs migrations 0007 and 0008. Safe to re-run: every insert is keyed on a fixed id, a unique
-- slug or email, or checked with NOT EXISTS.

-- Rental categories: a listing must be filed under one of Amoria's `rental` categories.
INSERT IGNORE INTO category (kind, slug, name, name_am, sort_order) VALUES
	('rental', 'venues', 'Venues', 'የዝግጅት ቦታዎች', 1),
	('rental', 'chairs-tables', 'Chairs and tables', 'ወንበሮችና ጠረጴዛዎች', 2),
	('rental', 'decor-backdrops', 'Décor and backdrops', 'ዲኮርና ዳራዎች', 3),
	('rental', 'lighting-sound', 'Lighting and sound', 'መብራትና ድምፅ', 4),
	('rental', 'linens-tableware', 'Linens and tableware', 'የጠረጴዛ ልብስና ዕቃዎች', 5),
	('rental', 'tents', 'Tents and canopies', 'ድንኳኖች', 6);

-- Renter sign-ins: role `renter`, a better-auth credential row each (scrypt hashes of the
-- passwords in accounts.md).
INSERT IGNORE INTO user (id, name, email, email_verified, role, phone) VALUES
	('demo-renter-amoria', 'Amoria Rentals', 'rentals@amoria.test', 1, 'renter', '+251911000101'),
	('demo-renter-selam', 'Selam Tesfaye', 'selam@renters.test', 1, 'renter', '+251911000102'),
	('demo-renter-habesha', 'Dawit Bekele', 'habesha@renters.test', 1, 'renter', '+251911000103'),
	('demo-renter-lumiere', 'Hana Girma', 'lumiere@renters.test', 1, 'renter', '+251911000104'),
	('demo-renter-bloom', 'Meron Alemu', 'bloom@renters.test', 1, 'renter', '+251911000105'),
	('demo-renter-adama', 'Yonas Tadesse', 'adama@renters.test', 1, 'renter', '+251911000106');

INSERT IGNORE INTO account (id, account_id, provider_id, user_id, password) VALUES
	('demo-renter-amoria-cred', 'demo-renter-amoria', 'credential', 'demo-renter-amoria',
		'ad3ec6595a31d53954848cf17c98cd48:a75dca0f36a1e93f765a304fd2a3ed8cfb8693ebe15e8d39b28f6ca11e84754f03a2337a38328cede3c88946516b51b2612e187b2b15655feb319fcf44974d2b'),
	('demo-renter-selam-cred', 'demo-renter-selam', 'credential', 'demo-renter-selam',
		'79c123d7d580b81eead26b6c83255fe2:782a140991fb9e4ff31b4f6b4b53cc09969d311b231e98cc67b41954bc7ebf1e85f2aecf77554acdae889e6ed9ddf3e7bb44760f0b067812a18c46f5d2c5c6c7'),
	('demo-renter-habesha-cred', 'demo-renter-habesha', 'credential', 'demo-renter-habesha',
		'fde3aec979c46d39a1098cc7ae79aa2f:6a168bf156d20d63e3dab05a5bae02895edd51466a37337b2cb69faf3145af8875025e0e65bbc1b8b14025dfe24d4fcb2dce98403f8bdb99b8ada5b36d200955'),
	('demo-renter-lumiere-cred', 'demo-renter-lumiere', 'credential', 'demo-renter-lumiere',
		'47338fcad84894c755da3bd5e5388bad:e8a16ca02cd4d8d57a5d65270cff8729401bce2a3bd487bbb37f327ff226e6d15efca35bf89774c30036600e5b1e6c625417b31d6b7b09fa2167eac255ded60f'),
	('demo-renter-bloom-cred', 'demo-renter-bloom', 'credential', 'demo-renter-bloom',
		'4752c285f0e16f06ecaf0877c7a4ed5f:1cbeabfd0da0606dec4a0623dc12c1d93dd85ab6972dd1f97c9a32b3c0fb3aeebb7f6828dc1a9c276c547b2fc48a149e49fb9594f7f5a03044439725852a1103'),
	('demo-renter-adama-cred', 'demo-renter-adama', 'credential', 'demo-renter-adama',
		'da54a35be5db1f654878e53309424754:67db65c1db70935f26f5ca18c908a57a3a6dc955757310c66f8099124713396a7d55d8624f8bdd1362dbe2ca03acb85539e9aad33a4e37fe0eecedc4de7e93f0');

-- The businesses. Amoria Rentals is the company's own profile: approved, featured and trusted, so
-- its equipment sits in the marketplace next to everyone else's. Adama Tents waits for review.
SET @admin := (SELECT id FROM user WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at LIMIT 1);

INSERT IGNORE INTO renter
	(user_id, slug, business_name, business_name_am, tagline, tagline_am, about, policies, logo_file,
	 cover_file, area, service_areas, founded_year, offers_delivery, offers_setup, phone, whatsapp,
	 telegram, tin_number, trade_licence_file, status, reviewed_by, reviewed_at, approved_at,
	 auto_publish, is_featured)
VALUES
	('demo-renter-amoria', 'amoria-rentals', 'Amoria Rentals', 'አሞሪያ ኪራይ',
		'The décor we style our own events with, for yours', 'በራሳችን ዝግጅቶች የምንጠቀምበት ዲኮር፣ ለእርስዎም',
		'Amoria''s own stock: the letters, chandeliers, drapes and arches from our weddings and parties. Book them on their own, or ask us to style the whole event.',
		'50% deposit to confirm. Free cancellation up to 7 days before. Damage beyond normal wear is charged at cost.',
		'demo-renter-amoria-logo.webp', 'demo-renter-amoria-cover.webp', 'Bole, Addis Ababa',
		'Addis Ababa, Bishoftu, Adama', 2018, 1, 1, '+251911000101', '+251911000101', 'amoria_rentals',
		'0000000101', 'demo-licence-amoria.png', 'approved', @admin, UTC_TIMESTAMP() - INTERVAL 60 DAY,
		UTC_TIMESTAMP() - INTERVAL 60 DAY, 1, 1),
	('demo-renter-selam', 'selam-event-rentals', 'Selam Event Rentals', 'ሰላም የዝግጅት ኪራይ',
		'Chairs, tables and linens for 20 to 2,000 guests', 'ከ20 እስከ 2,000 እንግዶች ወንበር፣ ጠረጴዛና የጠረጴዛ ልብስ',
		'A family business renting furniture for weddings, graduations and conferences since 2012. We deliver, set up and collect.',
		'Delivery inside Addis is free over 5,000 birr. Chairs are counted on delivery and collection.',
		'demo-renter-selam-logo.webp', 'demo-renter-selam-cover.webp', 'Megenagna, Addis Ababa',
		'Addis Ababa, Sululta, Bishoftu', 2012, 1, 1, '+251911000102', '+251911000102', NULL,
		'0000000102', 'demo-licence-selam.png', 'approved', @admin, UTC_TIMESTAMP() - INTERVAL 45 DAY,
		UTC_TIMESTAMP() - INTERVAL 45 DAY, 1, 1),
	('demo-renter-habesha', 'habesha-garden-venues', 'Habesha Garden Venues', 'ሐበሻ የአትክልት ስፍራ',
		'A garden, a hall and a terrace in Old Airport', 'በኦልድ ኤርፖርት የአትክልት ስፍራ፣ አዳራሽና ቴራስ',
		'Three spaces on one compound, with parking for 80 cars and our own kitchen team on request.',
		'Bookings are confirmed with a 30% advance. Music must end by 11 pm.',
		'demo-renter-habesha-logo.webp', 'demo-renter-habesha-cover.webp', 'Old Airport, Addis Ababa',
		'Addis Ababa', 2016, 0, 1, '+251911000103', '+251911000103', 'habesha_venues',
		'0000000103', 'demo-licence-habesha.png', 'approved', @admin, UTC_TIMESTAMP() - INTERVAL 30 DAY,
		UTC_TIMESTAMP() - INTERVAL 30 DAY, 0, 0),
	('demo-renter-lumiere', 'lumiere-light-sound', 'Lumière Light & Sound', 'ሉሚየር መብራትና ድምፅ',
		'Uplighting, chandeliers and PA, with a technician', 'የመብራት፣ የሻንደሊየርና የድምፅ ሲስተም ከባለሙያ ጋር',
		'Lighting and sound for weddings, launches and concerts. Every booking comes with a technician for the night.',
		'Power must be available at the venue, or add our generator. 40% advance.',
		'demo-renter-lumiere-logo.webp', 'demo-renter-lumiere-cover.webp', 'Sarbet, Addis Ababa',
		'Addis Ababa, Adama, Hawassa', 2019, 1, 1, '+251911000104', NULL, 'lumiere_et',
		'0000000104', 'demo-licence-lumiere.png', 'approved', @admin, UTC_TIMESTAMP() - INTERVAL 20 DAY,
		UTC_TIMESTAMP() - INTERVAL 20 DAY, 0, 0),
	('demo-renter-bloom', 'bloom-decor-hire', 'Bloom Décor Hire', 'ብሉም ዲኮር ኪራይ',
		'Arches, flower walls and centrepieces', 'አርች፣ የአበባ ግድግዳና የጠረጴዛ ማስዋቢያ',
		'Reusable silk-flower décor, styled and set up by our team.',
		'Items are set up and collected by us. Lost centrepieces are charged at 1,500 birr each.',
		'demo-renter-bloom-logo.webp', 'demo-renter-bloom-cover.webp', 'CMC, Addis Ababa',
		'Addis Ababa', 2021, 1, 1, '+251911000105', '+251911000105', NULL,
		'0000000105', 'demo-licence-bloom.png', 'approved', @admin, UTC_TIMESTAMP() - INTERVAL 10 DAY,
		UTC_TIMESTAMP() - INTERVAL 10 DAY, 0, 0),
	('demo-renter-adama', 'adama-tents', 'Adama Tents', 'አዳማ ድንኳን',
		'Tents and canopies for outdoor events', 'ለውጪ ዝግጅቶች ድንኳን',
		'Tents from 50 to 500 guests, delivered and pitched anywhere in Oromia.',
		NULL, 'demo-renter-adama-logo.webp', 'demo-renter-adama-cover.webp', 'Adama',
		'Adama, Bishoftu, Mojo', 2015, 1, 1, '+251911000106', NULL, NULL,
		'0000000106', 'demo-licence-adama.png', 'pending', NULL, NULL, NULL, 0, 0);

-- Where their customers transfer to.
INSERT INTO renter_bank_account (renter_id, bank_name, account_name, account_number, sort_order)
SELECT r.id, b.bank, b.holder, b.number, b.sort
FROM (
	SELECT 'amoria-rentals' AS slug, 'Commercial Bank of Ethiopia' AS bank, 'Amoria Events PLC' AS holder, '1000000000101' AS number, 1 AS sort
	UNION ALL SELECT 'amoria-rentals', 'Dashen Bank', 'Amoria Events PLC', '2000000000101', 2
	UNION ALL SELECT 'selam-event-rentals', 'Commercial Bank of Ethiopia', 'Selam Tesfaye', '1000000000102', 1
	UNION ALL SELECT 'selam-event-rentals', 'Awash Bank', 'Selam Event Rentals', '3000000000102', 2
	UNION ALL SELECT 'habesha-garden-venues', 'Bank of Abyssinia', 'Habesha Garden Venues', '4000000000103', 1
	UNION ALL SELECT 'lumiere-light-sound', 'Commercial Bank of Ethiopia', 'Hana Girma', '1000000000104', 1
	UNION ALL SELECT 'bloom-decor-hire', 'Dashen Bank', 'Meron Alemu', '2000000000105', 1
	UNION ALL SELECT 'adama-tents', 'Awash Bank', 'Yonas Tadesse', '3000000000106', 1
) b
JOIN renter r ON r.slug = b.slug
WHERE NOT EXISTS (
	SELECT 1 FROM renter_bank_account x WHERE x.renter_id = r.id AND x.account_number = b.number
);

-- What they rent out. `item` is a flat price per piece for the booking, `day` per piece per day.
INSERT IGNORE INTO renter_listing
	(renter_id, category_id, slug, name, name_am, summary, description, features, pricing, price,
	 price_unit, deposit, quantity, capacity, delivery_available, setup_included, status, reviewed_by,
	 reviewed_at, published_at, sort_order)
SELECT r.id, c.id, l.slug, l.name, l.name_am, l.summary, l.description, l.features, l.pricing, l.price,
	l.unit, l.deposit, l.qty, l.capacity, l.delivery, l.setup, l.status,
	IF(l.status = 'approved', @admin, NULL),
	IF(l.status = 'approved', UTC_TIMESTAMP() - INTERVAL l.age DAY, NULL),
	IF(l.status = 'approved', UTC_TIMESTAMP() - INTERVAL l.age DAY, NULL), l.sort
FROM (
	-- Amoria's own
	SELECT 'amoria-rentals' AS renter, 'decor-backdrops' AS cat, 'amoria-gold-marquee-letters' AS slug,
		'Gold marquee letters' AS name, 'የወርቅ ቀለም መብራት ፊደላት' AS name_am,
		'Light-up letters, 1.2 m tall: names, initials or LOVE.' AS summary,
		'Battery or mains powered. Price is per letter for the event; we deliver and place them.' AS description,
		'["1.2 m tall", "Warm white bulbs", "Delivery and placing included"]' AS features,
		'fixed' AS pricing, 800.00 AS price, 'item' AS unit, 200.00 AS deposit, 12 AS qty, NULL AS capacity,
		1 AS delivery, 1 AS setup, 'approved' AS status, 50 AS age, 1 AS sort
	UNION ALL SELECT 'amoria-rentals', 'lighting-sound', 'amoria-crystal-chandeliers', 'Crystal chandeliers', 'የክሪስታል ሻንደሊየር',
		'Hanging crystal chandeliers for halls and tents.', 'Hung by our team on your truss or ceiling hooks.',
		'["80 cm wide", "Hanging included", "Dimmable"]', 'fixed', 3500.00, 'event', 1000.00, 6, NULL, 1, 1, 'approved', 48, 2
	UNION ALL SELECT 'amoria-rentals', 'decor-backdrops', 'amoria-drape-backdrop', 'Ivory drape backdrop', 'የአይቮሪ መጋረጃ ዳራ',
		'A 6 m pleated drape wall for stages and head tables.', NULL,
		'["6 m × 3 m", "Frame included", "Fairy lights on request"]', 'fixed', 6000.00, 'event', 1500.00, 2, NULL, 1, 1, 'approved', 40, 3
	UNION ALL SELECT 'amoria-rentals', 'decor-backdrops', 'amoria-flower-arch', 'Flower arch, styled', 'የአበባ አርች',
		'Our ceremony arch, dressed in fresh or silk flowers to your colours.', 'Priced by size and flowers; ask us.',
		'["Fresh or silk flowers", "Styled to your palette"]', 'quote', 12000.00, 'event', 0.00, 2, NULL, 1, 1, 'approved', 35, 4
	-- Selam
	UNION ALL SELECT 'selam-event-rentals', 'chairs-tables', 'selam-chiavari-chairs', 'Gold Chiavari chairs', 'የወርቅ ቺያቫሪ ወንበሮች',
		'Gold Chiavari chairs with ivory cushions.', 'The wedding classic. Delivered, set out and collected.',
		'["Ivory cushions", "Delivery over 100 chairs free"]', 'fixed', 120.00, 'item', 20.00, 800, NULL, 1, 1, 'approved', 40, 1
	UNION ALL SELECT 'selam-event-rentals', 'chairs-tables', 'selam-ceremony-chairs', 'White folding chairs', 'ነጭ ታጣፊ ወንበሮች',
		'Light folding chairs for garden ceremonies.', NULL,
		'["Weatherproof", "Bows on request"]', 'fixed', 45.00, 'item', 10.00, 1500, NULL, 1, 0, 'approved', 38, 2
	UNION ALL SELECT 'selam-event-rentals', 'chairs-tables', 'selam-banquet-tables', 'Long banquet tables', 'ረጅም የግብዣ ጠረጴዛዎች',
		'2.4 m tables seating 10, for long-table receptions.', NULL,
		'["2.4 m × 0.9 m", "Seats 10"]', 'fixed', 350.00, 'day', 100.00, 120, NULL, 1, 1, 'approved', 30, 3
	UNION ALL SELECT 'selam-event-rentals', 'linens-tableware', 'selam-table-linens', 'Table linens and runners', 'የጠረጴዛ ልብስና ራነር',
		'Ivory, gold and sage cloths with matching runners.', NULL,
		'["Washed and pressed", "12 colours"]', 'fixed', 150.00, 'item', 0.00, 400, NULL, 1, 0, 'approved', 25, 4
	-- Habesha
	UNION ALL SELECT 'habesha-garden-venues', 'venues', 'habesha-garden', 'The Garden', 'የአትክልት ስፍራው',
		'A lawn garden under old acacias for up to 400 guests.', 'Our largest space: lawn, a covered stage and a bar corner.',
		'["Covered stage", "Parking for 80 cars", "Bridal room"]', 'quote', 60000.00, 'event', 0.00, 1, 400, 0, 1, 'approved', 28, 1
	UNION ALL SELECT 'habesha-garden-venues', 'venues', 'habesha-hall', 'The Grand Hall', 'ታላቁ አዳራሽ',
		'An air-conditioned hall for banquets of 250.', NULL,
		'["Air conditioning", "Kitchen on request", "Sound system"]', 'fixed', 85000.00, 'day', 20000.00, 1, 250, 0, 1, 'approved', 26, 2
	UNION ALL SELECT 'habesha-garden-venues', 'venues', 'habesha-terrace', 'The Terrace', 'ቴራሱ',
		'A rooftop terrace for engagements and dinners of 60.', NULL,
		'["City view", "Heaters for the evening"]', 'fixed', 3500.00, 'hour', 0.00, 1, 60, 0, 0, 'approved', 20, 3
	-- Lumière
	UNION ALL SELECT 'lumiere-light-sound', 'lighting-sound', 'lumiere-chandelier-package', 'Chandelier hall package', 'የሻንደሊየር አዳራሽ ፓኬጅ',
		'Eight chandeliers, truss and warm wash lights.', 'Installed the day before, struck after the event.',
		'["8 chandeliers", "Truss", "Technician on the night"]', 'fixed', 45000.00, 'event', 10000.00, 2, NULL, 1, 1, 'approved', 18, 1
	UNION ALL SELECT 'lumiere-light-sound', 'lighting-sound', 'lumiere-uplighting', 'LED uplighting', 'ኤልኢዲ አፕላይቲንግ',
		'Wireless uplights in any colour, per light per day.', NULL,
		'["Battery powered", "Any colour"]', 'fixed', 600.00, 'day', 150.00, 40, NULL, 1, 1, 'approved', 15, 2
	UNION ALL SELECT 'lumiere-light-sound', 'lighting-sound', 'lumiere-pa-system', 'PA system with DJ desk', 'የድምፅ ሲስተም ከዲጄ ጠረጴዛ ጋር',
		'Speakers, mixer and microphones sized to your guest count.', NULL,
		'["2 × 1000 W speakers", "4 wireless microphones", "Generator on request"]', 'quote', NULL, 'event', 0.00, 3, NULL, 1, 1, 'approved', 12, 3
	-- Bloom: one live, one waiting for Amoria's review, one draft
	UNION ALL SELECT 'bloom-decor-hire', 'decor-backdrops', 'bloom-centrepieces', 'Tall floral centrepieces', 'ረጃጅም የአበባ ማስዋቢያዎች',
		'Gold stands with silk-flower toppers, per table.', NULL,
		'["90 cm tall", "Silk flowers", "Set up included"]', 'fixed', 900.00, 'item', 300.00, 60, NULL, 1, 1, 'approved', 8, 1
	UNION ALL SELECT 'bloom-decor-hire', 'decor-backdrops', 'bloom-balloon-arch', 'Balloon arch', 'የፊኛ አርች',
		'An organic balloon arch in your colours.', NULL,
		'["Up to 4 m", "Any colours"]', 'fixed', 7500.00, 'event', 0.00, 4, NULL, 1, 1, 'pending_review', 0, 2
	UNION ALL SELECT 'bloom-decor-hire', 'decor-backdrops', 'bloom-flower-wall', 'Flower wall', 'የአበባ ግድግዳ',
		'A 2.4 m silk rose wall for photos.', NULL,
		'["2.4 m × 2.4 m"]', 'fixed', 9000.00, 'event', 2000.00, 1, NULL, 1, 1, 'draft', 0, 3
	-- Adama (not approved yet, so nothing shows)
	UNION ALL SELECT 'adama-tents', 'tents', 'adama-frame-tent', 'Frame tent, 200 guests', 'የ200 እንግዶች ድንኳን',
		'A 15 × 25 m frame tent with sidewalls.', NULL,
		'["15 m × 25 m", "Sidewalls", "Pitched by our crew"]', 'quote', 40000.00, 'event', 0.00, 3, 200, 1, 1, 'draft', 0, 1
) l
JOIN renter r ON r.slug = l.renter
JOIN category c ON c.kind = 'rental' AND c.slug = l.cat;

INSERT INTO renter_listing_image (listing_id, file_name, alt, sort_order)
SELECT li.id, p.file, li.name, p.sort
FROM (
	SELECT 'amoria-gold-marquee-letters' AS slug, 'demo-rent-amoria-gold-letters.webp' AS file, 1 AS sort
	UNION ALL SELECT 'amoria-crystal-chandeliers', 'demo-rent-amoria-chandeliers.webp', 1
	UNION ALL SELECT 'amoria-drape-backdrop', 'demo-rent-amoria-drape-backdrop.webp', 1
	UNION ALL SELECT 'amoria-flower-arch', 'demo-rent-amoria-flower-arch.webp', 1
	UNION ALL SELECT 'selam-chiavari-chairs', 'demo-rent-selam-chiavari-chairs.webp', 1
	UNION ALL SELECT 'selam-ceremony-chairs', 'demo-rent-selam-ceremony-chairs.webp', 1
	UNION ALL SELECT 'selam-banquet-tables', 'demo-rent-selam-banquet-tables.webp', 1
	UNION ALL SELECT 'selam-table-linens', 'demo-rent-selam-table-linens.webp', 1
	UNION ALL SELECT 'habesha-garden', 'demo-rent-habesha-garden.webp', 1
	UNION ALL SELECT 'habesha-garden', 'demo-rent-habesha-terrace.webp', 2
	UNION ALL SELECT 'habesha-hall', 'demo-rent-habesha-hall.webp', 1
	UNION ALL SELECT 'habesha-terrace', 'demo-rent-habesha-terrace.webp', 1
	UNION ALL SELECT 'lumiere-chandelier-package', 'demo-rent-lumiere-chandelier-hall.webp', 1
	UNION ALL SELECT 'lumiere-chandelier-package', 'demo-rent-amoria-chandeliers.webp', 2
	UNION ALL SELECT 'lumiere-uplighting', 'demo-rent-lumiere-uplighting.webp', 1
	UNION ALL SELECT 'bloom-centrepieces', 'demo-rent-bloom-centrepieces.webp', 1
	UNION ALL SELECT 'bloom-balloon-arch', 'demo-rent-bloom-balloon-arch.webp', 1
	UNION ALL SELECT 'bloom-flower-wall', 'demo-rent-bloom-flower-wall.webp', 1
) p
JOIN renter_listing li ON li.slug = p.slug
WHERE NOT EXISTS (
	SELECT 1 FROM renter_listing_image x WHERE x.listing_id = li.id AND x.file_name = p.file
);

-- Amoria's own event spaces (`/spaces`), managed by staff at /dashboard/spaces.
INSERT IGNORE INTO rental_space
	(slug, name, name_am, summary, description, features, capacity, size_text, price, price_unit,
	 price_unit_am, sort_order, created_by)
VALUES
	('amoria-grand-hall', 'Amoria Grand Hall', 'አሞሪያ ታላቅ አዳራሽ',
		'Our chandelier hall for weddings and galas.',
		'A high-ceilinged hall with crystal chandeliers, a stage and a bridal suite. Book it bare or styled by Amoria.',
		'["Crystal chandeliers", "Stage and dance floor", "Bridal suite", "Parking for 60 cars"]',
		350, '600 m², ground floor', 120000.00, 'per day', 'በቀን', 1, @admin),
	('amoria-garden', 'Amoria Garden', 'አሞሪያ የአትክልት ስፍራ',
		'A walled garden for ceremonies and receptions.',
		'Lawn, a pergola for the ceremony and space for a tent when the rains come.',
		'["Ceremony pergola", "Room for a 300-guest tent", "Garden lighting"]',
		300, '1,200 m² lawn', 80000.00, 'per event', 'በዝግጅት', 2, @admin),
	('amoria-studio', 'Amoria Party Studio', 'አሞሪያ የፓርቲ ስቱዲዮ',
		'A small styled room for birthdays, showers and shoots.',
		NULL, '["Styled backdrop wall", "Sound system", "Kitchenette"]',
		40, '80 m²', 2500.00, 'per hour', 'በሰዓት', 3, @admin);

INSERT INTO rental_space_image (space_id, file_name, alt, sort_order)
SELECT s.id, p.file, p.alt, p.sort
FROM (
	SELECT 'amoria-grand-hall' AS slug, 'demo-space-grand-hall.webp' AS file, 'The hall set for a dinner, under a crystal chandelier' AS alt, 1 AS sort
	UNION ALL SELECT 'amoria-grand-hall', 'demo-space-grand-hall-2.webp', 'Long banquet tables between the columns', 2
	UNION ALL SELECT 'amoria-grand-hall', 'demo-space-grand-hall-3.webp', 'The hall empty, seen from the balcony', 3
	UNION ALL SELECT 'amoria-garden', 'demo-space-garden.webp', 'The lawn set for a ceremony, white chairs facing the arch', 1
	UNION ALL SELECT 'amoria-garden', 'demo-space-garden-2.webp', 'The pergola walk', 2
	UNION ALL SELECT 'amoria-studio', 'demo-space-studio.webp', 'The studio dressed for a birthday, with flowers and balloons', 1
	UNION ALL SELECT 'amoria-studio', 'demo-space-studio-2.webp', 'The studio with high tables for a reception', 2
	UNION ALL SELECT 'amoria-studio', 'demo-space-studio-3.webp', 'The studio empty: wood floor and tall windows', 3
) p
JOIN rental_space s ON s.slug = p.slug
WHERE NOT EXISTS (
	SELECT 1 FROM rental_space_image x WHERE x.space_id = s.id AND x.file_name = p.file
);

-- Rows seeded before the photos had their own captions: give them one.
UPDATE rental_space_image i
JOIN rental_space s ON s.id = i.space_id
SET i.alt = CASE i.file_name
	WHEN 'demo-space-grand-hall.webp' THEN 'The hall set for a dinner, under a crystal chandelier'
	WHEN 'demo-space-grand-hall-2.webp' THEN 'Long banquet tables between the columns'
	WHEN 'demo-space-garden.webp' THEN 'The lawn set for a ceremony, white chairs facing the arch'
	WHEN 'demo-space-garden-2.webp' THEN 'The pergola walk'
	WHEN 'demo-space-studio.webp' THEN 'The studio dressed for a birthday, with flowers and balloons'
	WHEN 'demo-space-studio-2.webp' THEN 'The studio with high tables for a reception'
	ELSE i.alt END
WHERE i.alt = s.name;
