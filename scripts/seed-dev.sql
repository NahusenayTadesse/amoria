-- DEVELOPMENT ONLY: demo catalogue and transfer accounts, so the shop has something to show.
-- Not real Amoria products, prices or accounts. Never run against the production database.
--
--   mariadb -u dev amoria < scripts/seed-dev.sql
--
-- Safe to re-run: every insert is keyed on a unique slug/number and ignored if present.
--
-- The photos rows below point at demo-*.webp files that scripts/demo-images.sh downloads into
-- FILES_DIR: stock photos, not Amoria's work, to be replaced before launch.

-- Earlier versions of this seed named five gifts differently; rename them to match their photos.
UPDATE product p JOIN (
	SELECT 'sunflower-bunch' AS old_slug, 'garden-bouquet' AS slug, 'Garden bouquet' AS name, 'የአትክልት አበባ እቅፍ' AS name_am, 'Seasonal garden flowers, hand-tied.' AS description
	UNION ALL SELECT 'coffee-lovers-box', 'spring-gift-box', 'Spring gift box', 'የጸደይ ስጦታ ሳጥን', 'Fresh flowers and treats in a keepsake box.'
	UNION ALL SELECT 'heart-balloon-set', 'balloon-bundle', 'Balloon bundle', 'የፊኛ ጥቅል', 'Six filled balloons in party colours.'
	UNION ALL SELECT 'photo-frame', 'keepsake-box', 'Keepsake box', 'የማስታወሻ ሳጥን', 'A ribboned box for letters and small treasures.'
	UNION ALL SELECT 'scented-candle', 'wrapped-surprise', 'Wrapped surprise', 'የተጠቀለለ ሰርፕራይዝ', 'A small gift, wrapped with ribbon and a card.'
) r ON r.old_slug = p.slug
SET p.slug = r.slug, p.name = r.name, p.name_am = r.name_am, p.description = r.description,
	p.is_featured = p.slug IN ('sunflower-bunch', 'heart-balloon-set');

INSERT IGNORE INTO category (kind, slug, name, name_am, sort_order) VALUES
	('gift', 'flowers', 'Flowers', 'አበባዎች', 1),
	('gift', 'gift-boxes', 'Gift boxes', 'የስጦታ ሳጥኖች', 2),
	('gift', 'balloons', 'Balloons', 'ፊኛዎች', 3),
	('gift', 'keepsakes', 'Keepsakes', 'ማስታወሻዎች', 4);

INSERT IGNORE INTO product
	(kind, category_id, slug, name, name_am, description, price, stock_qty, is_featured, published_at, sort_order)
SELECT 'gift', c.id, p.slug, p.name, p.name_am, p.description, p.price, p.stock, p.featured, NOW() - INTERVAL 1 DAY, p.sort
FROM (
	SELECT 'flowers' AS cat, 'red-rose-bouquet' AS slug, 'Red rose bouquet' AS name, 'የቀይ ጽጌረዳ እቅፍ' AS name_am, 'Twelve red roses, wrapped.' AS description, 1450.00 AS price, 8 AS stock, 1 AS featured, 1 AS sort
	UNION ALL SELECT 'flowers', 'garden-bouquet', 'Garden bouquet', 'የአትክልት አበባ እቅፍ', 'Seasonal garden flowers, hand-tied.', 950.00, 2, 1, 2
	UNION ALL SELECT 'gift-boxes', 'chocolate-gift-box', 'Chocolate gift box', 'የቸኮሌት ስጦታ ሳጥን', 'Assorted chocolates in a ribboned box.', 1200.00, 15, 1, 1
	UNION ALL SELECT 'gift-boxes', 'birthday-surprise-box', 'Birthday surprise box', 'የልደት ሰርፕራይዝ ሳጥን', 'Chocolates, a candle and a card.', 2300.00, 5, 0, 2
	UNION ALL SELECT 'gift-boxes', 'spring-gift-box', 'Spring gift box', 'የጸደይ ስጦታ ሳጥን', 'Fresh flowers and treats in a keepsake box.', 1850.00, 0, 0, 3
	UNION ALL SELECT 'balloons', 'balloon-bundle', 'Balloon bundle', 'የፊኛ ጥቅል', 'Six filled balloons in party colours.', 600.00, 20, 1, 1
	UNION ALL SELECT 'balloons', 'number-balloon', 'Gold number balloon', 'የወርቅ ቁጥር ፊኛ', 'One large gold digit.', 450.00, 30, 0, 2
	UNION ALL SELECT 'keepsakes', 'keepsake-box', 'Keepsake box', 'የማስታወሻ ሳጥን', 'A ribboned box for letters and small treasures.', 1100.00, 3, 0, 1
	UNION ALL SELECT 'keepsakes', 'wrapped-surprise', 'Wrapped surprise', 'የተጠቀለለ ሰርፕራይዝ', 'A small gift, wrapped with ribbon and a card.', 700.00, 12, 0, 2
) AS p
JOIN category c ON c.slug = p.cat;

INSERT INTO bank_account (bank_name, account_name, account_number, sort_order)
SELECT * FROM (
	SELECT 'Commercial Bank of Ethiopia' AS bank_name, 'Amoria Gifts (demo)' AS account_name, '1000123456789' AS account_number, 1 AS sort_order
	UNION ALL SELECT 'Telebirr', 'Amoria Gifts (demo)', '0911234567', 2
) AS a
WHERE NOT EXISTS (SELECT 1 FROM bank_account b WHERE b.account_number = a.account_number);

-- Delivery areas with demo fees (not Amoria's real ones).
INSERT IGNORE INTO delivery_area (name, name_am, fee, sort_order) VALUES
	('Mekanisa', 'መካኒሳ', 100.00, 1),
	('Lebu', 'ለቡ', 150.00, 2),
	('Sarbet', 'ሳር ቤት', 150.00, 3),
	('Bole', 'ቦሌ', 250.00, 4),
	('Piassa', 'ፒያሳ', 250.00, 5),
	('CMC', 'ሲኤምሲ', 350.00, 6);

-- Gift photos (demo). One per product, keyed on the file name.
INSERT INTO product_image (product_id, file_name, alt, sort_order)
SELECT p.id, i.file_name, i.alt, 0
FROM (
	SELECT 'red-rose-bouquet' AS slug, 'demo-red-rose-bouquet.webp' AS file_name, 'A bouquet of red roses' AS alt
	UNION ALL SELECT 'garden-bouquet', 'demo-garden-bouquet.webp', 'A hand-tied bouquet of garden flowers'
	UNION ALL SELECT 'chocolate-gift-box', 'demo-chocolate-gift-box.webp', 'An open box of assorted chocolates'
	UNION ALL SELECT 'birthday-surprise-box', 'demo-birthday-surprise-box.webp', 'A birthday gift box with ribbon'
	UNION ALL SELECT 'spring-gift-box', 'demo-spring-gift-box.webp', 'A gift box with flowers and treats'
	UNION ALL SELECT 'balloon-bundle', 'demo-balloon-bundle.webp', 'A bundle of party balloons'
	UNION ALL SELECT 'number-balloon', 'demo-gold-number-balloon.webp', 'A gold number balloon'
	UNION ALL SELECT 'keepsake-box', 'demo-keepsake-box.webp', 'A ribboned keepsake box'
	UNION ALL SELECT 'wrapped-surprise', 'demo-wrapped-surprise.webp', 'A small wrapped gift with a bow'
) AS i
JOIN product p ON p.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM product_image x WHERE x.file_name = i.file_name);

INSERT IGNORE INTO event_type (slug, name, name_am, sort_order) VALUES
	('wedding', 'Wedding', 'ሠርግ', 1),
	('engagement', 'Engagement', 'ቀለበት ማሰር', 2),
	('birthday', 'Birthday', 'ልደት', 3),
	('baby-shower', 'Baby shower', 'የሕፃን ሻወር', 4),
	('graduation', 'Graduation', 'ምረቃ', 5),
	('corporate', 'Corporate event', 'የድርጅት ዝግጅት', 6);

-- Décor packages with demo prices (not Amoria's real ones).
INSERT IGNORE INTO decor_package
	(slug, event_type_id, tier, name, name_am, summary, summary_am, inclusions, inclusions_am, starting_price, sort_order)
SELECT d.slug, e.id, d.tier, d.name, d.name_am, d.summary, d.summary_am, d.inclusions, d.inclusions_am, d.price, d.sort
FROM (
	SELECT 'birthday-balloon-party' AS slug, 'birthday' AS event, 'basic' AS tier,
		'Balloon party' AS name, 'የፊኛ ድግስ' AS name_am,
		'A balloon arch, a backdrop and a cake table for a birthday at home or in a hall.' AS summary,
		'ለልደት በቤት ወይም በአዳራሽ የፊኛ ቅስት፣ ዳራ እና የኬክ ጠረጴዛ።' AS summary_am,
		'["Balloon arch in your colours","Name backdrop","Cake table styling","Set-up and take-down"]' AS inclusions,
		'["በመረጡት ቀለም የፊኛ ቅስት","የስም ዳራ","የኬክ ጠረጴዛ ማስዋብ","ማዘጋጀት እና ማንሳት"]' AS inclusions_am,
		8500.00 AS price, 1 AS sort
	UNION ALL SELECT 'engagement-garden', 'engagement', 'premium',
		'Garden engagement', 'የአትክልት ቀለበት ማሰር',
		'An outdoor canopy, lounge seating and fresh flowers for a ring ceremony.',
		'ለቀለበት ሥነ ሥርዓት የውጪ ድንኳን፣ የመቀመጫ ስፍራ እና ትኩስ አበቦች።',
		'["Canopy with drapes","Lounge seating for the couple","Fresh flower centrepieces","Warm string lights"]',
		'["ድንኳን ከመጋረጃ ጋር","ለጥንዶቹ መቀመጫ","የትኩስ አበባ ማስዋቢያዎች","ሞቅ ያሉ መብራቶች"]',
		28000.00, 2
	UNION ALL SELECT 'wedding-grand-hall', 'wedding', 'luxury',
		'Grand hall wedding', 'የትልቅ አዳራሽ ሠርግ',
		'The full hall: stage, head table, guest tables and lighting, planned with you.',
		'ሙሉ አዳራሽ፦ መድረክ፣ የሙሽሮች ጠረጴዛ፣ የእንግዶች ጠረጴዛዎች እና መብራት፣ ከእርስዎ ጋር ታቅዶ።',
		'["Stage and head table design","Guest table linen and centrepieces","Entrance and aisle flowers","Lighting and drapes"]',
		'["የመድረክ እና የሙሽሮች ጠረጴዛ ንድፍ","የእንግዶች ጠረጴዛ ልብስ እና ማስዋቢያ","የመግቢያ እና የመተላለፊያ አበቦች","መብራት እና መጋረጃዎች"]',
		95000.00, 3
) AS d
JOIN event_type e ON e.slug = d.event;

INSERT INTO package_image (package_id, file_name, alt, sort_order)
SELECT d.id, i.file_name, i.alt, 0
FROM (
	SELECT 'birthday-balloon-party' AS slug, 'demo-pkg-birthday.webp' AS file_name, 'A balloon arch over a birthday table' AS alt
	UNION ALL SELECT 'engagement-garden', 'demo-pkg-engagement.webp', 'An outdoor canopy set for a reception'
	UNION ALL SELECT 'wedding-grand-hall', 'demo-pkg-wedding.webp', 'A wedding hall with a decorated stage'
) AS i
JOIN decor_package d ON d.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM package_image x WHERE x.file_name = i.file_name);

-- Portfolio pieces (demo: stock photos, not events Amoria decorated).
INSERT IGNORE INTO portfolio_item (slug, title, title_am, event_type_id, venue, is_featured, sort_order)
SELECT f.slug, f.title, f.title_am, e.id, f.venue, 1, f.sort
FROM (
	SELECT 'demo-floral-mandap' AS slug, 'Floral ceremony stage' AS title, 'የአበባ ሥነ ሥርዓት መድረክ' AS title_am, 'wedding' AS event, 'Demo venue' AS venue, 1 AS sort
	UNION ALL SELECT 'demo-garden-arches', 'Garden arches', 'የአትክልት ቅስቶች', 'wedding', 'Demo venue', 2
	UNION ALL SELECT 'demo-birthday-arch', 'Birthday balloon arch', 'የልደት የፊኛ ቅስት', 'birthday', 'Demo venue', 3
	UNION ALL SELECT 'demo-cake-chandeliers', 'Cake under chandeliers', 'ኬክ በመብራቶች ሥር', 'wedding', 'Demo venue', 4
	UNION ALL SELECT 'demo-grand-banquet', 'Grand banquet', 'ታላቅ ግብዣ', 'corporate', 'Demo venue', 5
	UNION ALL SELECT 'demo-chandelier-hall', 'Chandelier hall', 'የመብራት አዳራሽ', 'engagement', 'Demo venue', 6
) AS f
JOIN event_type e ON e.slug = f.event;

INSERT INTO portfolio_image (portfolio_item_id, file_name, alt, sort_order)
SELECT p.id, i.file_name, i.alt, 0
FROM (
	SELECT 'demo-floral-mandap' AS slug, 'demo-pf-floral-mandap.webp' AS file_name, 'A ceremony stage framed in flowers' AS alt
	UNION ALL SELECT 'demo-garden-arches', 'demo-pf-garden-arches.webp', 'Flower arches in a garden'
	UNION ALL SELECT 'demo-birthday-arch', 'demo-pf-birthday-arch.webp', 'A balloon arch for a birthday'
	UNION ALL SELECT 'demo-cake-chandeliers', 'demo-pf-cake-chandeliers.webp', 'A wedding cake under chandeliers'
	UNION ALL SELECT 'demo-grand-banquet', 'demo-pf-grand-banquet.webp', 'Long banquet tables set for guests'
	UNION ALL SELECT 'demo-chandelier-hall', 'demo-pf-chandelier-hall.webp', 'A hall lit by chandeliers'
) AS i
JOIN portfolio_item p ON p.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM portfolio_image x WHERE x.file_name = i.file_name);

-- Décor school (demo): three courses, each with an upcoming intake. Dates are relative to today so
-- the seed never goes stale; re-running adds neither courses nor intakes twice.
INSERT IGNORE INTO course (slug, title, title_am, summary, summary_am, curriculum, fee, duration_text, sort_order) VALUES
('demo-balloon-arches', 'Balloon arches and garlands', 'የፊኛ ቅስት እና ጉንጉን',
 'Build a full balloon arch from a bare frame: structure, colour and finish.',
 'ከባዶ ፍሬም ጀምሮ ሙሉ የፊኛ ቅስት መሥራት፦ አወቃቀር፣ ቀለም እና አጨራረስ።',
 '["Frames and structure","Colour and balance","Organic garlands","Finishing and transport"]', 4500, '6 weeks, Saturdays', 1),
('demo-table-styling', 'Wedding table styling', 'የሠርግ ጠረጴዛ አቀማመጥ',
 'Set a guest table and a head table that photograph well and work on the day.',
 NULL,
 '["Linen and layout","Centrepieces","Place settings","Lighting the table"]', 3200, '4 weeks, Sundays', 2),
('demo-stage-design', 'Stage and backdrop design', 'የመድረክ እና ጀርባ ዲዛይን',
 'Plan, build and light a ceremony stage from a brief.',
 NULL,
 '["Reading a brief","Building the backdrop","Flowers and greenery","Lighting the stage","Setting up on site"]', 7500, '8 weeks, weekends', 3);

INSERT INTO course_intake (course_id, start_date, end_date, schedule_text, seat_limit, status)
SELECT c.id, DATE_ADD(CURDATE(), INTERVAL i.start_in DAY), DATE_ADD(CURDATE(), INTERVAL i.end_in DAY), i.schedule, i.seats, 'open'
FROM (
	SELECT 'demo-balloon-arches' AS slug, 14 AS start_in, 56 AS end_in, 'Saturdays 9:00 to 12:00' AS schedule, 10 AS seats
	UNION ALL SELECT 'demo-table-styling', 21, 49, 'Sundays 14:00 to 17:00', 3
	UNION ALL SELECT 'demo-stage-design', 30, 86, 'Weekends 9:00 to 13:00', 8
) AS i
JOIN course c ON c.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM course_intake x WHERE x.course_id = c.id);
