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

# derive <source> <destination> <WxH>: a crop of a photo already fetched above (needs ImageMagick)
derive() {
	magick "$1" -resize "$3^" -gravity center -extent "$3" -quality 78 "$2"
	echo "  $2"
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
derive "$STATIC/gallery-hall-drapes.webp" "$UPLOADS/demo-pkg-wedding.webp" 1000x750
fetch 1772127822525-7eda37383b9f "$UPLOADS/demo-pkg-engagement.webp" 1000 750

echo "Portfolio (square)"
derive "$STATIC/gallery-floral-tables.webp" "$UPLOADS/demo-pf-floral-tables.webp" 1200x1200

# More package photos: crops of the photos above, one per extra package in seed-dev.sql
derive "$STATIC/gallery-ceremony-chairs.webp" "$UPLOADS/demo-pkg-wedding-aisle-and-tables.webp" 1000x750
derive "$STATIC/gallery-long-table.webp" "$UPLOADS/demo-pkg-wedding-stage-and-tables.webp" 1000x750
derive "$STATIC/gallery-aisle-chairs.webp" "$UPLOADS/demo-pkg-engagement-simple-corner.webp" 1000x750
derive "$STATIC/gallery-garden-reception.webp" "$UPLOADS/demo-pkg-engagement-garden-luxury.webp" 1000x750
derive "$STATIC/hero-cake.webp" "$UPLOADS/demo-pkg-birthday-party-studio.webp" 1000x750
derive "$STATIC/gallery-gold-letters.webp" "$UPLOADS/demo-pkg-birthday-grand-gold.webp" 1000x750
derive "$STATIC/hero-bouquet.webp" "$UPLOADS/demo-pkg-baby-shower-simple.webp" 1000x750
derive "$STATIC/gallery-centerpiece.webp" "$UPLOADS/demo-pkg-baby-shower-garden.webp" 1000x750
derive "$STATIC/hero-aisle.webp" "$UPLOADS/demo-pkg-graduation-basic.webp" 1000x750
derive "$STATIC/gallery-table-garden.webp" "$UPLOADS/demo-pkg-graduation-party.webp" 1000x750
derive "$STATIC/gallery-evening-hall.webp" "$UPLOADS/demo-pkg-corporate-launch.webp" 1000x750
derive "$STATIC/gallery-hall-drapes.webp" "$UPLOADS/demo-pkg-corporate-gala.webp" 1000x750
fetch 1747115276395-607f2e5dc269 "$UPLOADS/demo-pf-garden-arches.webp" 1000 1000
fetch 1741969494307-55394e3e4071 "$UPLOADS/demo-pf-birthday-arch.webp" 1000 1000
fetch 1560117531-02eeab8e3593 "$UPLOADS/demo-pf-cake-chandeliers.webp" 1000 1000
fetch 1762765684665-6b6855bb6fe6 "$UPLOADS/demo-pf-grand-banquet.webp" 1000 1000
fetch 1717680281618-442cb9c12b6c "$UPLOADS/demo-pf-chandelier-hall.webp" 1000 1000

echo "Done. Now: mariadb -u dev amoria < scripts/seed-dev.sql"

# Course photos for the décor school
derive "$UPLOADS/demo-pf-birthday-arch.webp" "$UPLOADS/demo-course-balloon-arches.webp" 1000x750
derive "$STATIC/gallery-floral-tables.webp" "$UPLOADS/demo-course-table-styling.webp" 1000x750
derive "$STATIC/gallery-hall-drapes.webp" "$UPLOADS/demo-course-stage-design.webp" 1000x750
derive "$STATIC/hero-bouquet.webp" "$UPLOADS/demo-course-bouquets-wrapping.webp" 1000x750
derive "$STATIC/hero-cake.webp" "$UPLOADS/demo-course-cake-dessert-tables.webp" 1000x750
derive "$STATIC/gallery-long-table.webp" "$UPLOADS/demo-course-start-decor-business.webp" 1000x750

# Small copies of the gallery photos (480px wide) for phones; see $lib/img.ts.
for photo in "$STATIC"/gallery-*.webp; do
	case "$photo" in *-480.webp) continue ;; esac
	magick "$photo" -resize 480x -quality 72 "${photo%.webp}-480.webp"
done
