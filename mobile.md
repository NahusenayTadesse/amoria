# Amoria on a phone: findings and ways to make it feel like an app

Written 2026-10-05 after reviewing the storefront at phone size. The PWA basics (installable, offline fallback, bottom tab bar, page cross-fades) are already in; this file is about what to do next.

## What was reviewed, and how

- **Setup:** Chromium emulating a 390×844 phone at 2× with touch, against the dev server and the seeded dev database. I also ran a production build to test the service worker.
- **Pages looked at:** home, shop, school list, course page, class registration, about, contact, the checkout sheet, login, and the Amharic home page.
- **Measured:** page heights, image counts and weight, tap-target sizes, input font sizes, and horizontal scroll (none on any page).
- **Not reviewed:** the staff dashboard on a phone, the order-status and certificate pages, a real iPhone or Android device, a throttled connection, and screen readers. Anything below that touches those is a hypothesis, and says so.
- **JavaScript size:** the dev server's JS numbers are meaningless. Re-measure with a Lighthouse mobile run against a production build before acting on performance.

One bug found during the review is already fixed: the service worker showed the "You are offline" page for any unsaved page that took more than 4 seconds to load, even while online. Without a saved copy it now waits for the network.

## Status: what has been done (2026-10-06)

Everything below was built and checked on a 390×844 phone in Chromium. The server, client and database tests pass (389 in all, including the new push, quote-request and product-card tests), as do `npm run check` and eslint.

| # | Finding | Done |
| --- | --- | --- |
| 1 | Long home page | Home is 8,685px, down from 10,870. Packages are a swipeable row on phones, sections have less padding, the steps block is tighter, and the gallery shows 6 photos. |
| 2 | Chrome eats the screen | The header is 56px and slides away on the way down the page. The footer loses its links and signboard on phones. Language and install moved to More. |
| 3 | Tab bar | Home, Shop, School, Bag (with a count) and More. The Bag tab opens checkout. The count is also set on the app icon where supported. |
| 4 | Shop | The photo opens a bottom sheet with swipeable photos, the description, add to bag, Buy now and Share. Cards have one + button that becomes a stepper. Categories stay under the header. Back closes the sheet. |
| 5 | Registration | Date ranges are chips, then that range's shifts. The fee and pay button are pinned to the bottom, and the tab bar steps aside. English pages show the Gregorian date first. |
| 6 | Touch targets | The 20 to 36px targets are now 44px or more, and buttons give pressed feedback. |
| 7 | Navigation | Preload on tap, a loading line at the top, and a short tick on add to bag (Android). |
| 8 | Images | 480px copies of the gallery photos and 640px copies of the shop photos with `srcset`. |
| 9 | Fonts | Self-hosted (about 620 KB, latin and Ethiopic), preloaded, and cached by the service worker. |
| PWA | Extras | A once-a-month install banner from the second visit, manifest screenshots, iOS splash screens, and the shop, school, about and contact pages saved for offline on first visit. Course cards have photos. The checkout fields ask for the right keyboard and autofill. |

**Added afterwards (2026-10-06)**
- **Web push for customers:** a phone can follow an order or a class registration ("Get updates on this phone" on `/o/…` and `/reg/…`). It is told when the payment arrives, when an order is preparing, ready, completed or cancelled, when a seat is confirmed or cancelled, when a course result is in, and the day before a class starts. Details are in `docs/PLATFORM.md` §8.1. Needs `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in the environment. On iPhone it works only for the installed app.
- **Offline queue:** the new "Plan your décor" request form (`/decor/quote`, listed in the spec, with a staff list at `/dashboard/quote-requests`) saves a request on the phone when there is no signal and sends it when the connection returns, once even if it arrives twice.
- **Google-hosted Inter:** the admin kit now has `styles/theme.base.css` (the theme without the Google font), and Amoria uses it with Inter self-hosted. The same change lets the kit's heading and paragraph rules skip a subtree marked `data-site-type`, which the storefront now uses. The effect on phones: storefront headings are the sizes the design asks for (the kit had been forcing every `h1` to 24px) and paragraphs are in the storefront's own font instead of Inter.
- **Staff dashboard on a phone:** reviewed (below).

**Staff dashboard on a 390px phone** (reviewed with the green theme, on the Today, Orders, Products, Till, Stock, School, Students and Quote requests pages, with screenshots and a check for sideways overflow; the Settings page was measured, not looked at)
- No page scrolls sideways, and the till fits the screen.
- The table toolbar (search, columns, export, filters) was cut off on the right and could only be reached by swiping a hidden scroll area. It now wraps under the search box on phones (admin kit 0.1.36).
- Still open: wide tables scroll sideways inside their frame (readable, but the key columns are not pinned), the page intro paragraphs are long on a small screen, and many buttons are 36px tall, under the 44px target. These come from the kit's table and buttons, and are the next things to fix there.

**Still not done**
- Nothing has been tried on a real iPhone or Android phone, and push delivery could not be exercised in a headless browser (there is no push service to reach); the server side is tested with a stand-in for the push service.
- Staff alerts for new quote requests: the staff list is there, but no alert goes out until the messaging outbox exists.

## What already works well

- No horizontal scrolling anywhere, and every image has `width` and `height`, so nothing jumps while loading.
- The registration form's inputs are 16px, so iOS will not zoom in when they are focused.
- The checkout is already a bottom sheet with a three-step progress bar and a pinned total and button.
- The gifts strip on the home page scrolls sideways, which is the right pattern.
- The tab bar, install button and offline page are in place.

## Findings, most valuable first

### 1. The home page is a brochure, not an app screen
The home page is **10,870px tall, about 13 screens**, with 39 images. The "Start from a package" section shows 3 packages, but each is a full-width card of about 600px on a phone, so roughly 1,800px for three. Apps keep the first screen short and put depth behind taps.

- Show the packages in a sideways-scrolling row of narrower cards, as the gifts strip already does, with a link to the rest.
- Turn "How décor works" into one compact card, or a 3-step horizontal scroller.
- Cut the home page to about 5 screens: hero, four-ways grid, gifts row, packages row, shop and contact. The gallery and the school block become links to their own pages.

### 2. The chrome eats the screen
The header is 81px, the tab bar is 64px, and the iPhone home-indicator area is extra. Together that is about **145px of 844px (17%)** that never scrolls away.

- Slim the header to about 56px with a smaller logo.
- Hide the header when scrolling down and show it when scrolling up. The tab bar stays.
- The footer repeats the tab bar's five links and adds two large signboard banners. On phones, drop the footer's link row and keep only the address and pick-up line.
- Move the language switcher and install button into a "More" tab. At that point the header can be just the logo.

### 3. Tab bar contents
About is the weakest of the five tabs. A better set is **Home, Shop, School, Bag, More**, with these changes:
- Give the Bag tab a count badge. At the moment the bag only appears as a floating bar after something is added.
- More holds About, Contact and chat, the language switcher, Install, and the policy pages.
- Contact is already reachable from the home page, and a floating WhatsApp or Telegram button could replace its tab.

### 4. Shop: product cards and no detail view
- Each card has two stacked full-width buttons, "Buy now" and "Add to bag", about 100px of buttons per card. App pattern: one round **+** button on the photo corner that becomes a − 1 + stepper once added. Keep "Buy now" for the detail view.
- I found no product detail page or sheet in the storefront routes (`shop/[[category]]` only). A product cannot be opened, zoomed or swiped. Add a **bottom sheet** with a swipeable photo gallery, the description, and the add-to-bag stepper. Use SvelteKit shallow routing (`pushState`) so the Back button closes it.
- The category chips already scroll sideways. Make them sticky under the header so switching category does not need a scroll back up.

### 5. Class registration is a very long form
On the registration page the date picker lists three date ranges, each with two shift cards, about 1,200px before the form starts. The "Your seat" summary card is above it and pushes the picker down.

- Show the date ranges as horizontal chips, then the shifts for the chosen range.
- Pin the fee and a Continue button to the bottom of the screen, above the tab bar, like the checkout sheet.
- Make the registration a step flow (date, details, payment) like the checkout.
- On the English pages, dates show both calendars, for example "2 ጥቅምት 2019 (12 Oct 2026)", which wraps to two lines. Show the Gregorian date on English pages and the Ethiopian one on Amharic pages.
- Hide the tab bar on this page and the checkout, so the only call to action is the pinned one.

### 6. Touch targets are under 44px in several places
Measured: footer links 36px, "See every gift" 22px, course card titles 22px, "All courses" back link 20px, password show/hide button 20×20, header controls 40px, "Register" buttons 36px. Aim for at least 44px.

- Make whole cards tappable instead of small text links.
- Add a pressed state (`:active` scale or tint) to buttons and cards, so a tap gives instant feedback. Hover effects do not do this on touch.

### 7. Navigation gives no feedback and does not preload
- `src/app.html` uses `data-sveltekit-preload-data="hover"`, which never fires on a phone. Switch to `tap` (starts loading on touch-down) or `viewport` for the tab bar links.
- Pages load their data on the server, and the home and shop pages query the database. During that wait nothing changes on screen. Add a thin progress bar at the top driven by `navigating` from `$app/state`, and skeleton placeholders for the shop grid.
- Keep scroll position per tab when going back and forth, as native tab bars do.

### 8. Images
The first full scroll of the home page loads about **4.4 MB of images**, and the shop about 0.9 MB. The gallery photos are 900px wide but display at roughly 180px on a phone.

- Generate 400px and 800px versions and use `srcset` and `sizes`. `@sveltejs/enhanced-img`, or the existing seed and upload scripts with ImageMagick, would do it.
- Uploaded product and package photos are served as-is from `/media`; resize on upload.
- The course cards on `/school` use a 220px green gradient with a cap icon. Use a photo, or a compact horizontal card with the title, date and seats.

### 9. Fonts
Four Google Fonts families, including Noto Sans Ethiopic, are loaded from Google as a render-blocking stylesheet. They fail offline, and the first paint waits for them on a slow connection. There is already a TODO for this in the store layout.

- Self-host and subset them, with `font-display: swap`, and preload the two used above the fold.
- Add the font files to the service worker's cached shell.

### 10. Dashboard and staff use (hypotheses, not reviewed)
Staff will likely use the till, stock counts and class registers on a phone or tablet. Worth checking next: whether the kit's tables turn into cards on small screens, tap sizes in the till, and camera barcode scanning (`BarcodeDetector`) for stock and POS. The manifest already has a "Staff dashboard" shortcut.

## PWA features still to add

| Feature | Why | Notes |
| --- | --- | --- |
| Install banner at the right moment | The header button is easy to miss | Show a dismissible banner after the second visit or after a first order; remember a dismissal for 30 days |
| Manifest `screenshots` | Richer install dialog on Android and desktop Chrome | One narrow (phone) and one wide screenshot |
| iOS splash screens | iOS shows a white flash on launch without them | `apple-touch-startup-image` per device size |
| Web push notifications | Order ready for pick-up, class reminders, quote replies | Needs a push subscription table and the outbox the platform spec lists as still missing. iOS only supports push for installed apps (16.4 and up) |
| Offline message queue | A contact or quote request sent on a bad connection should not be lost | Safari has no Background Sync, so store in IndexedDB and retry on the `online` event |
| App badge | Bag count or unread items on the icon | `navigator.setAppBadge`, Chromium only |
| Web Share | Share a product or package | `navigator.share` with a fallback to copy link |
| Offline catalogue | Browse the shop with no signal | Today only pages already visited work offline. Cache the shop page and its images when the service worker installs |

## Smaller touches

- Haptic tick when adding to the bag (`navigator.vibrate(10)`, Android only).
- The status bar is already green on Android and iOS. A dark theme for the storefront would need `theme-color` per scheme.
- Use `inputmode` and `autocomplete` on the checkout fields (phone, email, name) so the right keyboard and autofill appear. I did not check whether they are set.
- Confirm that the bag survives closing the app. I did not check how `bag.svelte.ts` stores it.
- Long-press and text-selection are already off on the header and navigation when installed.
- Avoid hamburger menus and sideways swipe between tabs: the tab bar covers navigation, and swiping fights with the sideways-scrolling rows.

## Suggested order of work

**Quick (each under a day):**
1. Preload on tap, and the navigation progress bar (finding 7).
2. Slim header that hides on scroll, and a shorter footer on phones (finding 2).
3. Bag tab with badge and a More tab (finding 3).
4. Tap-target sizes and pressed states (finding 6).
5. One + button on product cards (finding 4).

**Medium:**
6. Product bottom sheet with gallery and Back-button handling (finding 4).
7. Shorten the home page: packages row, compact steps (finding 1).
8. Registration as a step flow with a pinned Continue (finding 5).
9. Responsive images and self-hosted fonts (findings 8 and 9).
10. Install banner, manifest screenshots, iOS splash screens.

**Larger:**
11. Web push, once the message outbox exists.
12. Offline message queue and offline catalogue.
13. A phone pass over the staff dashboard (finding 10).
