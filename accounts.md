# Seeded accounts (development only)

Local dev database `amoria` only. Never reuse these credentials in production.

| Role   | Name / business                         | Email                  | Password              | Sign in at |
| ------ | --------------------------------------- | ---------------------- | --------------------- | ---------- |
| Admin  | Nahu Admin                              | admin@amoria.test      | `Amoria-Admin-2026!`  | `/login`   |
| Renter | Amoria Rentals (the company's own)      | rentals@amoria.test    | `Amoria-Rentals-2026!` | `/login` → `/renter` |
| Renter | Selam Tesfaye · Selam Event Rentals     | selam@renters.test     | `Selam-Rent-2026!`    | `/login` → `/renter` |
| Renter | Dawit Bekele · Habesha Garden Venues    | habesha@renters.test   | `Habesha-Venue-2026!` | `/login` → `/renter` |
| Renter | Hana Girma · Lumière Light & Sound      | lumiere@renters.test   | `Lumiere-Light-2026!` | `/login` → `/renter` |
| Renter | Meron Alemu · Bloom Décor Hire          | bloom@renters.test     | `Bloom-Decor-2026!`   | `/login` → `/renter` |
| Renter | Yonas Tadesse · Adama Tents             | adama@renters.test     | `Adama-Tent-2026!`    | `/login` → `/renter` |

What the renters hold (`scripts/seed-dev-renters.sql`):

- **Amoria Rentals**: approved, featured, trusted (posts without review). 4 live listings: gold marquee letters, crystal chandeliers, drape backdrop, flower arch (quote).
- **Selam Event Rentals**: approved, featured, trusted. 4 live: Chiavari chairs, folding chairs, banquet tables, linens.
- **Habesha Garden Venues**: approved. 3 live venues (garden by quote, hall per day, terrace per hour).
- **Lumière Light & Sound**: approved. 3 live (chandelier package, uplighting, PA by quote).
- **Bloom Décor Hire**: approved. 1 live, 1 waiting for staff review (balloon arch), 1 draft (flower wall).
- **Adama Tents**: waiting for approval (shows in `/dashboard/renters`), 1 draft listing.

Amoria's own event spaces (`/spaces`, managed at `/dashboard/spaces`): Grand Hall, Garden, Party Studio.

Notes:

- The admin is created once at `/setup` (404 after an admin exists). Staff accounts are created from the dashboard.
- The admin password was reset on 2026-10-06 because the original was unknown.
- `scripts/seed-dev.sql` seeds only catalogue data. Renter accounts come from `scripts/seed-dev-renters.sql` (run `bash scripts/demo-images.sh` first for the photos; needs migrations 0007 and 0008).
- Renter accounts can only use `/renter`, not `/dashboard`. To manage Amoria's own listings, sign in as rentals@amoria.test; staff approve and review every renter from `/dashboard/renters`.
