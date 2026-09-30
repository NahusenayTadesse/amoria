#!/usr/bin/env bash
# DEVELOPMENT ONLY: demo photos so the shop and the home page look finished while Amoria's own
# photos are not in yet (PLATFORM.md §15). Every file is named demo-* so it is easy to find and
# replace. They are stock photos from Unsplash (free under the Unsplash License), NOT Amoria's
# work: before launch, the gallery, portfolio and package photos must be Amoria's real ones.
#
#   bash scripts/demo-images.sh            # downloads, then load scripts/seed-dev.sql
#
# - static/images/demo/  the home gallery and the hero's floating photos (site design, committed)
# - $FILES_DIR (default .tempFiles)  gift, package and portfolio photos: the uploads the database
#   rows in seed-dev.sql point at, served to guests by /media
set -euo pipefail
cd "$(dirname "$0")/.."

STATIC=static/images/demo
UPLOADS=${FILES_DIR:-.tempFiles}
mkdir -p "$STATIC" "$UPLOADS"

# fetch <unsplash photo id> <destination> <width> [height]
# Resized and converted by Unsplash's image CDN, so nothing needs processing here.
fetch() {
	local id=$1 dest=$2 w=$3 h=${4:-}
	local size="w=$w"
	[ -n "$h" ] && size="w=$w&h=$h&fit=crop&crop=entropy"
	curl -fsS --retry 2 --max-time 60 -o "$dest" \
		"https://images.unsplash.com/photo-$id?$size&q=72&fm=webp&auto=format"
	echo "  $dest"
}

echo "Hero floating photos"
fetch 1523693916903-027d144a2b7d "$STATIC/hero-bouquet.webp" 480 600
fetch 1738225734899-30852be7e396 "$STATIC/hero-aisle.webp" 480 600
fetch 1559373098-e1caaccae791 "$STATIC/hero-cake.webp" 480 600

echo "Home gallery (natural proportions, for a masonry layout)"
fetch 1510076857177-7470076d4098 "$STATIC/gallery-hall-drapes.webp" 900
fetch 1641996250159-9d2bbfb483fa "$STATIC/gallery-garden-reception.webp" 900
fetch 1665607437981-973dcd6a22bb "$STATIC/gallery-table-garden.webp" 900
fetch 1632316962873-47ee3d309f02 "$STATIC/gallery-long-table.webp" 900
fetch 1759124650320-d629a3d73d9f "$STATIC/gallery-floral-tables.webp" 900
fetch 1785744530692-0acb528235d4 "$STATIC/gallery-ceremony-chairs.webp" 900
fetch 1559982240-f760db87b822 "$STATIC/gallery-aisle-chairs.webp" 900
fetch 1457089328109-e5d9bd499191 "$STATIC/gallery-centerpiece.webp" 900
fetch 1768508951405-10e83c4a2872 "$STATIC/gallery-evening-hall.webp" 900
fetch 1772758767181-c5a93b8a52b2 "$STATIC/gallery-gold-letters.webp" 900

echo "Gift photos (square)"
fetch 1599791095997-5cf38bb5ff69 "$UPLOADS/demo-red-rose-bouquet.webp" 800 800
fetch 1589095181425-c038b3871b6a "$UPLOADS/demo-garden-bouquet.webp" 800 800
fetch 1694481901573-a970f982ac5e "$UPLOADS/demo-chocolate-gift-box.webp" 800 800
fetch 1674620213535-9b2a2553ef40 "$UPLOADS/demo-birthday-surprise-box.webp" 800 800
fetch 1707944145479-12755f0434d8 "$UPLOADS/demo-spring-gift-box.webp" 800 800
fetch 1604668915840-580c30026e5f "$UPLOADS/demo-balloon-bundle.webp" 800 800
fetch 1604668915999-03e1269f6af6 "$UPLOADS/demo-gold-number-balloon.webp" 800 800
fetch 1625552186152-668cd2f0b707 "$UPLOADS/demo-keepsake-box.webp" 800 800
fetch 1513201099705-a9746e1e201f "$UPLOADS/demo-wrapped-surprise.webp" 800 800

echo "Décor packages (4:3)"
fetch 1560128411-79892dd93bf8 "$UPLOADS/demo-pkg-birthday.webp" 1000 750
fetch 1587271407850-8d438ca9fdf2 "$UPLOADS/demo-pkg-wedding.webp" 1000 750
fetch 1772127822525-7eda37383b9f "$UPLOADS/demo-pkg-engagement.webp" 1000 750

echo "Portfolio (square)"
fetch 1587271636175-90d58cdad458 "$UPLOADS/demo-pf-floral-mandap.webp" 1200 1200
fetch 1747115276395-607f2e5dc269 "$UPLOADS/demo-pf-garden-arches.webp" 1000 1000
fetch 1741969494307-55394e3e4071 "$UPLOADS/demo-pf-birthday-arch.webp" 1000 1000
fetch 1560117531-02eeab8e3593 "$UPLOADS/demo-pf-cake-chandeliers.webp" 1000 1000
fetch 1762765684665-6b6855bb6fe6 "$UPLOADS/demo-pf-grand-banquet.webp" 1000 1000
fetch 1717680281618-442cb9c12b6c "$UPLOADS/demo-pf-chandelier-hall.webp" 1000 1000

echo "Done. Now: mariadb -u dev amoria < scripts/seed-dev.sql"
