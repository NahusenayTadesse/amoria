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
	UNION ALL SELECT 'wedding-grand-hall', 'demo-pkg-wedding.webp', 'A draped hall set for a wedding'
) AS i
JOIN decor_package d ON d.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM package_image x WHERE x.file_name = i.file_name);

-- Portfolio pieces (demo: stock photos, not events Amoria decorated).
INSERT IGNORE INTO portfolio_item (slug, title, title_am, event_type_id, venue, is_featured, sort_order)
SELECT f.slug, f.title, f.title_am, e.id, f.venue, 1, f.sort
FROM (
	SELECT 'demo-floral-tables' AS slug, 'Floral reception tables' AS title, 'የአበባ ግብዣ ጠረጴዛዎች' AS title_am, 'wedding' AS event, 'Demo venue' AS venue, 1 AS sort
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
	SELECT 'demo-floral-tables' AS slug, 'demo-pf-floral-tables.webp' AS file_name, 'Round tables dressed with tall flower centrepieces' AS alt
	UNION ALL SELECT 'demo-garden-arches', 'demo-pf-garden-arches.webp', 'Flower arches in a garden'
	UNION ALL SELECT 'demo-birthday-arch', 'demo-pf-birthday-arch.webp', 'A balloon arch for a birthday'
	UNION ALL SELECT 'demo-cake-chandeliers', 'demo-pf-cake-chandeliers.webp', 'A wedding cake under chandeliers'
	UNION ALL SELECT 'demo-grand-banquet', 'demo-pf-grand-banquet.webp', 'Long banquet tables set for guests'
	UNION ALL SELECT 'demo-chandelier-hall', 'demo-pf-chandelier-hall.webp', 'A hall lit by chandeliers'
) AS i
JOIN portfolio_item p ON p.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM portfolio_image x WHERE x.file_name = i.file_name);

-- More décor packages: two or three tiers for every event type (demo prices, not Amoria's).
INSERT IGNORE INTO decor_package
	(slug, event_type_id, tier, name, name_am, summary, summary_am, inclusions, inclusions_am, starting_price, sort_order)
SELECT d.slug, e.id, d.tier, d.name, d.name_am, d.summary, d.summary_am, d.inclusions, d.inclusions_am, d.price, d.sort
FROM (
	SELECT 'wedding-aisle-and-tables' AS slug, 'wedding' AS event, 'basic' AS tier, 'Ceremony aisle and tables' AS name, 'የሥነ ሥርዓት መተላለፊያ እና ጠረጴዛዎች' AS name_am, 'White chairs, an aisle of flowers and dressed guest tables for a smaller wedding.' AS summary, 'ለአነስተኛ ሠርግ ነጭ ወንበሮች፣ በአበባ የተሞላ መተላለፊያ እና ያጌጡ የእንግዶች ጠረጴዛዎች።' AS summary_am, '["Ceremony chairs with ribbon or flowers", "Aisle flowers", "Guest table linen", "Set-up and take-down"]' AS inclusions, '["የሥነ ሥርዓት ወንበሮች በሪባን ወይም በአበባ", "የመተላለፊያ አበቦች", "የእንግዶች ጠረጴዛ ልብስ", "ማዘጋጀት እና ማንሳት"]' AS inclusions_am, 45000.00 AS price, 4 AS sort
	UNION ALL SELECT 'wedding-stage-and-tables', 'wedding', 'premium', 'Stage and long tables', 'መድረክ እና ረጃጅም ጠረጴዛዎች', 'A flower-framed stage with long banquet tables, planned around your colours.', 'በአበባ የተከበበ መድረክ እና ረጃጅም የግብዣ ጠረጴዛዎች፣ በመረጡት ቀለም።', '["Stage and backdrop", "Long table styling", "Fresh flower runners", "Candles and lighting"]', '["መድረክ እና ጀርባ", "የረጅም ጠረጴዛ አቀማመጥ", "ትኩስ የአበባ ጌጦች", "ሻማ እና መብራት"]', 68000.00, 5
	UNION ALL SELECT 'engagement-simple-corner', 'engagement', 'basic', 'Engagement corner', 'የቀለበት ማሰር ጥግ', 'A styled corner with a backdrop, flowers and seating for a ring ceremony at home.', 'ለቤት ውስጥ የቀለበት ሥነ ሥርዓት ጀርባ፣ አበባ እና መቀመጫ ያለው ያጌጠ ጥግ።', '["Backdrop and flower arrangement", "Two lounge chairs", "Table styling", "Set-up and take-down"]', '["ጀርባ እና የአበባ ዝግጅት", "ሁለት መቀመጫዎች", "የጠረጴዛ ማስዋብ", "ማዘጋጀት እና ማንሳት"]', 12000.00, 4
	UNION ALL SELECT 'engagement-garden-luxury', 'engagement', 'luxury', 'Garden reception', 'የአትክልት ግብዣ', 'A full garden reception: hanging flowers, a lit canopy and styled tables for all your guests.', 'ሙሉ የአትክልት ግብዣ፦ የተንጠለጠሉ አበቦች፣ የበራ ድንኳን እና ለሁሉም እንግዶች የተዘጋጁ ጠረጴዛዎች።', '["Hanging flower canopy", "Guest table design", "Lounge area", "Lighting and heaters"]', '["የተንጠለጠሉ አበቦች ድንኳን", "የእንግዶች ጠረጴዛ ንድፍ", "የመቀመጫ ስፍራ", "መብራት እና ማሞቂያ"]', 52000.00, 5
	UNION ALL SELECT 'birthday-party-studio', 'birthday', 'premium', 'Birthday party', 'የልደት ድግስ', 'Balloons, a styled dessert table and a name backdrop for a party of up to 40.', 'እስከ 40 ሰው ለሚሆን ድግስ ፊኛዎች፣ የኬክ ጠረጴዛ እና የስም ጀርባ።', '["Balloon garland", "Dessert table styling", "Name backdrop", "Table settings for 40"]', '["የፊኛ ጉንጉን", "የኬክ ጠረጴዛ ማስዋብ", "የስም ጀርባ", "ለ40 ሰው የጠረጴዛ ዝግጅት"]', 16000.00, 2
	UNION ALL SELECT 'birthday-grand-gold', 'birthday', 'luxury', 'Grand gold birthday', 'ታላቅ የወርቅ ልደት', 'A milestone birthday in gold: letter balloons, a full backdrop and a styled hall.', 'በወርቃማ ቀለም ለልዩ ልደት፦ የፊደል ፊኛዎች፣ ሙሉ ጀርባ እና ያጌጠ አዳራሽ።', '["Gold letter or number balloons", "Full backdrop wall", "Hall and table styling", "Photo corner"]', '["ወርቃማ የፊደል ወይም የቁጥር ፊኛዎች", "ሙሉ የጀርባ ግድግዳ", "የአዳራሽ እና ጠረጴዛ ማስዋብ", "የፎቶ ጥግ"]', 32000.00, 3
	UNION ALL SELECT 'baby-shower-simple', 'baby-shower', 'basic', 'Baby shower table', 'የሕፃን ሻወር ጠረጴዛ', 'Soft colours, a balloon bunch and a flower-dressed treat table.', 'ለስላሳ ቀለማት፣ የፊኛ ጥቅል እና በአበባ የተጌጠ የጣፋጭ ጠረጴዛ።', '["Balloon bunches", "Treat table styling", "Fresh bouquet", "Set-up and take-down"]', '["የፊኛ ጥቅሎች", "የጣፋጭ ጠረጴዛ ማስዋብ", "ትኩስ የአበባ እቅፍ", "ማዘጋጀት እና ማንሳት"]', 7500.00, 1
	UNION ALL SELECT 'baby-shower-garden', 'baby-shower', 'premium', 'Baby shower lounge', 'የሕፃን ሻወር መቀመጫ ስፍራ', 'A backdrop, lounge seating and tall flower centrepieces for the mum-to-be.', 'ለወደፊቷ እናት ጀርባ፣ መቀመጫ እና ረጃጅም የአበባ ማስዋቢያዎች።', '["Themed backdrop", "Lounge seating", "Tall flower centrepieces", "Balloon garland"]', '["በጭብጥ የተሰራ ጀርባ", "የመቀመጫ ስፍራ", "ረጃጅም የአበባ ማስዋቢያዎች", "የፊኛ ጉንጉን"]', 15000.00, 2
	UNION ALL SELECT 'graduation-basic', 'graduation', 'basic', 'Graduation photo corner', 'የምረቃ የፎቶ ጥግ', 'A cap-and-gown photo corner with balloons and a congratulations backdrop.', 'የምረቃ ልብስ ለሚለበስበት የፎቶ ጥግ ከፊኛ እና የእንኳን ደስ አለዎት ጀርባ ጋር።', '["Photo backdrop", "Balloon arch", "Table and signage", "Set-up and take-down"]', '["የፎቶ ጀርባ", "የፊኛ ቅስት", "ጠረጴዛ እና ጽሑፍ", "ማዘጋጀት እና ማንሳት"]', 9000.00, 1
	UNION ALL SELECT 'graduation-party', 'graduation', 'premium', 'Graduation party', 'የምረቃ ድግስ', 'A garden or hall party for family and friends, with styled tables and a stage corner.', 'ለቤተሰብ እና ጓደኞች በአትክልት ወይም በአዳራሽ የሚደረግ ድግስ፣ ያጌጡ ጠረጴዛዎች እና የመድረክ ጥግ።', '["Stage corner", "Guest table styling", "Flower arrangements", "Lighting"]', '["የመድረክ ጥግ", "የእንግዶች ጠረጴዛ ማስዋብ", "የአበባ ዝግጅቶች", "መብራት"]', 18000.00, 2
	UNION ALL SELECT 'corporate-launch', 'corporate', 'basic', 'Office event', 'የቢሮ ዝግጅት', 'A clean, branded set-up for an office party, launch or training day.', 'ለቢሮ ድግስ፣ ምረቃ ወይም ሥልጠና ንጹህ እና የድርጅት አርማ ያለበት ዝግጅት።', '["Branded backdrop", "Table and seating layout", "Simple flowers", "Set-up and take-down"]', '["የድርጅት አርማ ጀርባ", "የጠረጴዛ እና መቀመጫ አቀማመጥ", "ቀላል አበባዎች", "ማዘጋጀት እና ማንሳት"]', 14000.00, 1
	UNION ALL SELECT 'corporate-gala', 'corporate', 'premium', 'Gala dinner', 'የጋላ እራት', 'Stage, drapes, lighting and dressed tables for an awards night or annual dinner.', 'ለሽልማት ምሽት ወይም ዓመታዊ እራት መድረክ፣ መጋረጃ፣ መብራት እና ያጌጡ ጠረጴዛዎች።', '["Stage and branding", "Ceiling drapes and lighting", "Table centrepieces", "On-site team"]', '["መድረክ እና የድርጅት አርማ", "የጣሪያ መጋረጃ እና መብራት", "የጠረጴዛ ማስዋቢያዎች", "በቦታው የሚገኝ ቡድን"]', 35000.00, 2
) AS d
JOIN event_type e ON e.slug = d.event;

INSERT INTO package_image (package_id, file_name, alt, sort_order)
SELECT d.id, i.file_name, i.alt, 0
FROM (
	SELECT 'wedding-aisle-and-tables' AS slug, 'demo-pkg-wedding-aisle-and-tables.webp' AS file_name, 'White ceremony chairs in rows' AS alt
	UNION ALL SELECT 'wedding-stage-and-tables', 'demo-pkg-wedding-stage-and-tables.webp', 'A long reception table under white drapes'
	UNION ALL SELECT 'engagement-simple-corner', 'demo-pkg-engagement-simple-corner.webp', 'A chair with a small flower arrangement'
	UNION ALL SELECT 'engagement-garden-luxury', 'demo-pkg-engagement-garden-luxury.webp', 'A garden table under a flower canopy'
	UNION ALL SELECT 'birthday-party-studio', 'demo-pkg-birthday-party-studio.webp', 'A celebration cake by a window with flowers'
	UNION ALL SELECT 'birthday-grand-gold', 'demo-pkg-birthday-grand-gold.webp', 'Gold balloon letters on a pale wall'
	UNION ALL SELECT 'baby-shower-simple', 'demo-pkg-baby-shower-simple.webp', 'A wrapped bouquet of pink roses'
	UNION ALL SELECT 'baby-shower-garden', 'demo-pkg-baby-shower-garden.webp', 'A tall bouquet of bright flowers'
	UNION ALL SELECT 'graduation-basic', 'demo-pkg-graduation-basic.webp', 'A curved light arch with white flowers'
	UNION ALL SELECT 'graduation-party', 'demo-pkg-graduation-party.webp', 'A long table set under a garden canopy'
	UNION ALL SELECT 'corporate-launch', 'demo-pkg-corporate-launch.webp', 'A hall of round tables lit for an evening event'
	UNION ALL SELECT 'corporate-gala', 'demo-pkg-corporate-gala.webp', 'A hall hung with white drapes and lights'
) AS i
JOIN decor_package d ON d.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM package_image x WHERE x.file_name = i.file_name);

-- Décor school (demo): six 20-day courses, each with three back-to-back runs in a morning and an
-- afternoon shift. Dates are relative to today so the seed never goes stale; re-running adds neither
-- courses nor classes twice.
INSERT IGNORE INTO school_shift (name, name_am, time_text, sort_order) VALUES
('Morning', 'ጠዋት', '9:00 to 12:00', 1),
('Afternoon', 'ከሰዓት', '14:00 to 17:00', 2),
('Evening', 'ምሽት', '18:00 to 20:30', 3);

INSERT IGNORE INTO course (slug, title, title_am, summary, summary_am, curriculum, curriculum_am, fee, duration_text, duration_days, max_students, sort_order) VALUES
('demo-balloon-arches', 'Balloon arches and garlands', 'የፊኛ ቅስት እና ጉንጉን',
 'Build a full balloon arch from a bare frame: structure, colour and finish.',
 'ከባዶ ፍሬም ጀምሮ ሙሉ የፊኛ ቅስት መሥራት፦ አወቃቀር፣ ቀለም እና አጨራረስ።',
 '["Frames and structure", "Colour and balance", "Organic garlands", "Finishing and transport"]',
 '["ፍሬም እና አወቃቀር", "ቀለም እና ሚዛን", "ተፈጥሯዊ ጉንጉኖች", "አጨራረስ እና ማጓጓዝ"]', 4500, '20 days', 20, 12, 1),
('demo-table-styling', 'Wedding table styling', 'የሠርግ ጠረጴዛ አቀማመጥ',
 'Set a guest table and a head table that photograph well and work on the day.',
 'በፎቶ የሚያምር እና በዕለቱ የሚሠራ የእንግዶች እና የሙሽሮች ጠረጴዛ ማዘጋጀት።',
 '["Linen and layout", "Centrepieces", "Place settings", "Lighting the table"]',
 '["የጠረጴዛ ልብስ እና አቀማመጥ", "ማስዋቢያዎች", "የመቀመጫ ዝግጅት", "የጠረጴዛ መብራት"]', 3200, '20 days', 20, 12, 2),
('demo-stage-design', 'Stage and backdrop design', 'የመድረክ እና ጀርባ ዲዛይን',
 'Plan, build and light a ceremony stage from a brief.',
 'ከአጭር ጥያቄ ተነስቶ የሥነ ሥርዓት መድረክ ማቀድ፣ መሥራት እና ማብራት።',
 '["Reading a brief", "Building the backdrop", "Flowers and greenery", "Lighting the stage", "Setting up on site"]',
 '["ጥያቄን መረዳት", "ጀርባ መሥራት", "አበባ እና ዕፅዋት", "መድረክ ማብራት", "በቦታው ማዘጋጀት"]', 7500, '20 days', 20, 12, 3),
('demo-bouquets-wrapping', 'Bouquets and gift wrapping', 'የአበባ እቅፍ እና ስጦታ መጠቅለል',
 'Hand-tie a bouquet and wrap gifts the way you would be proud to sell.',
 'የአበባ እቅፍ በእጅ ማሰር እና ስጦታዎችን ለመሸጥ በሚያኮራ መንገድ መጠቅለል።',
 '["Choosing and conditioning flowers", "Hand-tied bouquets", "Paper, ribbon and boxes", "Pricing for sale"]',
 '["አበባ መምረጥ እና ማዘጋጀት", "በእጅ የታሰሩ እቅፎች", "ወረቀት፣ ሪባን እና ሳጥኖች", "ዋጋ መተመን"]', 3800, '20 days', 20, 12, 4),
('demo-cake-dessert-tables', 'Cake and dessert tables', 'የኬክ እና የጣፋጭ ጠረጴዛዎች',
 'Style a dessert table with height, colour and props that suit the occasion.',
 'ለዝግጅቱ የሚስማማ ቁመት፣ ቀለም እና ማስዋቢያ ያለው የጣፋጭ ጠረጴዛ ማዘጋጀት።',
 '["Planning the table", "Stands and props", "Colour themes", "Photographing your work"]',
 '["ጠረጴዛውን ማቀድ", "መቆሚያዎች እና ማስዋቢያዎች", "የቀለም ጭብጦች", "ሥራዎን ፎቶ ማንሳት"]', 3000, '20 days', 20, 12, 5),
('demo-start-decor-business', 'Starting your décor business', 'የማስዋብ ሥራ መጀመር',
 'Quote jobs, buy stock, find clients and run your first events.',
 'ሥራ ዋጋ መተመን፣ እቃ መግዛት፣ ደንበኛ ማግኘት እና የመጀመሪያ ዝግጅቶችን መምራት።',
 '["Pricing and quoting", "Buying and storing stock", "Finding clients", "Running an event day", "Working with a team"]',
 '["ዋጋ መተመን", "እቃ መግዛት እና ማስቀመጥ", "ደንበኛ ማግኘት", "የዝግጅት ቀን አመራር", "ከቡድን ጋር መሥራት"]', 5500, '20 days', 20, 12, 6);

INSERT INTO course_intake (course_id, start_date, end_date, seat_limit, status, shift_id)
SELECT c.id,
	DATE_ADD(CURDATE(), INTERVAL (5 + c.sort_order * 2 + r.n * 20) DAY),
	DATE_ADD(CURDATE(), INTERVAL (5 + c.sort_order * 2 + r.n * 20 + 19) DAY),
	12, 'open', s.id
FROM course c
JOIN (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2) AS r
JOIN school_shift s ON s.name IN ('Morning', 'Afternoon')
WHERE c.slug LIKE 'demo-%'
	AND NOT EXISTS (SELECT 1 FROM course_intake x WHERE x.course_id = c.id);

-- Course photos (demo: stock photos), one per course, keyed on the file name.
INSERT INTO course_image (course_id, file_name, alt, sort_order)
SELECT c.id, i.file_name, i.alt, 0
FROM (
	SELECT 'demo-balloon-arches' AS slug, 'demo-course-balloon-arches.webp' AS file_name, 'A balloon arch over a table' AS alt
	UNION ALL SELECT 'demo-table-styling', 'demo-course-table-styling.webp', 'A guest table dressed with flowers'
	UNION ALL SELECT 'demo-stage-design', 'demo-course-stage-design.webp', 'A hall hung with drapes and lights'
	UNION ALL SELECT 'demo-bouquets-wrapping', 'demo-course-bouquets-wrapping.webp', 'A wrapped bouquet of pink roses'
	UNION ALL SELECT 'demo-cake-dessert-tables', 'demo-course-cake-dessert-tables.webp', 'A cake on a styled table'
	UNION ALL SELECT 'demo-start-decor-business', 'demo-course-start-decor-business.webp', 'A long table set for guests'
) AS i
JOIN course c ON c.slug = i.slug
WHERE NOT EXISTS (SELECT 1 FROM course_image x WHERE x.file_name = i.file_name);
