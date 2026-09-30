# Amoria Platform — Build Spec for Agents

This is the single source of truth for building the Amoria Digital Platform. Read it, and `AGENTS.md`, before designing a schema, a route or a component. When the code and this file disagree, raise it; don't silently pick one.

- **Client:** Amoria, Mekanisa, Addis Ababa: gift shop, equipment rental, décor services and décor school
- **Builder:** PulseData Solutions
- **Launch:** customer-facing site live **Saturday 24 October 2026 (14 Tikimt 2019 E.C.)**. The full staff dashboard follows in Phase 2.
- **Business background:** `~/Documents/amoria/` (package proposal and marketing strategy PDFs)
- **Kit:** `@nahu/admin-kit` at `../admin-kit` (read its `README.md`). The reference app that uses it most fully is `../dentalClinic`.

Markers used below: **[Decision]** means still open with the client, so build the stated default and keep it configurable. **[Verify on host]** means it depends on the cPanel server. **[Kit gap]** means the kit lacks it, so add it **to the kit**, not to this app (§2).

---

## 0. The two pillars

### Pillar 1: Componentization, through the admin-kit

- **The admin-kit is mandatory, not a suggestion.** Every table, form, field, dialog, detail page, status badge, date, amount, file, permission check, CRUD action, audit entry and soft delete goes through the kit. See §2 for the full contract.
- Build **one** piece per concept and reuse it everywhere. App-level components are allowed only for Amoria-specific UI (a product card, the quote builder), and even they are **assembled from kit pieces**.
- **Routes are thin.** `+page.server.ts` validates input, calls a kit CRUD helper or a service in `$lib/server/services`, and returns.
- **The four businesses share one payment pipeline** (§7). Adding a fifth sellable thing should mean implementing one interface.

### Pillar 2: Ease of use

- **Customer:** any purchase is at most three steps to paid. The phone number comes first, an account is never required, it works on a slow 3G phone, and it's available in Amharic or English.
- **Staff:** one "Today" screen shows everything that needs action. A quote can be built and sent from one screen. Every Telegram alert links straight to the record. The dashboard is usable on a phone.
- Errors are plain sentences that say what to do next ("That date is already booked — try the 14th"). Refusals use the kit's `WriteRefused`, so the message lands under the right field.

---

## 1. Stack (as set up in this repo)

| Concern                                       | Choice                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                                     | **SvelteKit 2 + Svelte 5 (runes forced)**, SSR      | `vite.config.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Adapter                                       | `@sveltejs/adapter-node`                            | Runs under cPanel "Setup Node.js App" (Passenger)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| DB                                            | **MySQL/MariaDB** via `drizzle-orm/mysql2`          | Schema in `src/lib/server/db/schema/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Migrations                                    | `drizzle-kit generate` + `migrate`                  | Prefer generated migrations over `push` in production                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Auth                                          | **better-auth** (email + password), Drizzle adapter | `src/lib/server/auth.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| i18n                                          | **Paraglide**, locales `en` (base) and `am`         | `messages/en.json`, `messages/am.json`, URL prefix `/am/...`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| UI, forms, tables, CRUD, files, access, dates | **`@nahu/admin-kit`**                               | Tailwind v4 + shadcn-svelte, superforms + zod 4, TanStack Table, Ethiopian calendar, `formatETB`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Tests                                         | Vitest in three projects, Playwright e2e            | `server`: plain logic and route handlers with mocks (`*.spec.ts`). `db`: services and form actions against a real MariaDB, `amoria_test`, migrated from `drizzle/` by `tests/db-global-setup.ts`; each test starts from empty tables (`src/lib/server/testing/db.ts`) and files run one at a time (`*.db.test.ts`). The kit's `inRollback` does not fit, because services open their own transactions. `client`: components in Chromium (`*.svelte.spec.ts`). Run with `npm run test:server`, `test:db`, `test:client` |

Agent tooling: use the Svelte MCP (`list-sections` → `get-documentation`, and `svelte-autofixer` on every `.svelte` file until clean), as described in `AGENTS.md`.

---

## 2. The admin-kit contract

### 2.1 Rules

1. **Look in the kit first, every time.** Its README table lists what it has. Import TypeScript modules without an extension (`@nahu/admin-kit/server/crud`), components with `.svelte`, and barrels with `/index.js`.
2. **Missing and generic means it goes into the kit.** Add it in `../admin-kit`, run `npm run check && npm test`, `npm run release`, then `npm install ../admin-kit --install-links` here. Every such item is marked **[Kit gap]** in this file.
3. **Missing and Amoria-specific means it goes in the app**, under `$lib/components/store` or `$lib/components/dashboard`, **composed of kit pieces**. Never a parallel copy of something the kit does.
4. **Never fork or copy kit code into the app.** If a kit piece is wrong for us, fix it in the kit.
5. **Follow the kit's data conventions**, because its helpers read columns by name: `fieldMixins` columns, `isActive`/`status`, `deletedAt`, `createdBy`/`updatedBy`, `sortOrder`, birr `money` fields, and filenames as strings.
6. **Copy dentalClinic's patterns** where the kit leaves something to the app: `db/connection.ts`, `db/dialect.ts`, the `schema/` folder, the permission tables and permission sync, and `hooks.server.ts`.

### 2.2 What to use for what

| Need                                                        | Use (from `@nahu/admin-kit/…`)                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column sets                                                 | `server/schema` → `fieldMixins(() => user.id)` gives `secureFields`, `lesserFields`, `deletionFields`, `approvalFields`. Export them once from `schema/secureFields.ts`                                                                                                                                                                                                                             |
| Lookup tables (categories, event types, roles)              | `server/crud` `contentCrud` + `components/lookup/LookupPage.svelte` with a `LookupConfig` (`text`, `textarea`, `number`, `money`, `boolean`, `date`, `reference`, choices)                                                                                                                                                                                                                          |
| Standalone content (products, packages, courses, portfolio) | `contentCrud` (`fileFields`, `listFields`, `references`, `transform`, `activeOnly`, `uniqueField`) + `data-table` + `FormDialog`                                                                                                                                                                                                                                                                    |
| Rows owned by a parent (images, intakes, quote items)       | `server/childCrud` `childCrud` / `childActions` (owner-scoped reads, server-stamped owner, owner-matched delete, `audit`, `permission`)                                                                                                                                                                                                                                                             |
| Deletes                                                     | `server/lookupDelete` `lookupDeleteAction`, `server/softDelete` (`notDeleted`, `deletionStamp`, `softDeleteLookup`, `softDeleteOwnedRecord`), `components/DeleteEntity.svelte`. Always behind `requireSuperAdmin`                                                                                                                                                                                   |
| Refusing a write with a reason                              | `server/childCrud` `WriteRefused`                                                                                                                                                                                                                                                                                                                                                                   |
| DB errors                                                   | `server/dbErrors` `isDuplicateKey`, `isForeignKeyViolation`, `hideFailure`                                                                                                                                                                                                                                                                                                                          |
| Insert and get the ID                                       | `server/db/insert` `insertReturningId`                                                                                                                                                                                                                                                                                                                                                              |
| Audit                                                       | `server/audit` `recordAudit` (same transaction), `auditChanges`, and `configureKit({ db, auditLog })`                                                                                                                                                                                                                                                                                               |
| Access and permissions                                      | `access` `createAccess` (rules in `src/lib/access.ts`), `server/hooks` `kitHandle`, `server/permissions` `hasPermission`, `requirePermission`, `requireSuperAdmin`                                                                                                                                                                                                                                  |
| Menu and record links                                       | `navigation` `NavItem` (`src/lib/navigation.ts`), `entityLinks` + `ENTITIES`                                                                                                                                                                                                                                                                                                                        |
| Dashboard shell                                             | `components/KitProvider.svelte`, `shell/AppSidebar`, `Search`, `DarkMode`, `LayoutMenu`, `AdminCard`                                                                                                                                                                                                                                                                                                |
| Forms (dashboard **and** storefront)                        | `forms/createForm` (superforms + toast), `formComponents/InputComp`, `SelectComp`, `ComboboxComp`, `CheckboxComp`, `DatePicker`, `DateRangePicker`, `FileUpload`, `FormCard`, `FormDialog`, `DialogComp`, `Errors`, `Messages`, `LoadingBtn`, `StepButton`                                                                                                                                          |
| Tables                                                      | `components/Table/data-table.svelte`. Use **server mode** for anything that grows (orders, bookings, quotes, payments, messages), with `server/queryFilters` `parseTableQuery`, `buildWhere`, `orderBy`, plus `QueryBuilder.svelte`. Cells: `data-table-sort`, `data-table-links`, `statuses`, `bigText`, `address`, `expiry-cell`, `tableCells` (`userCell`, `ethiopianDate`, `ethiopianDateTime`) |
| Status badges                                               | `components/Table/statuses.svelte`, everywhere including the storefront. **[Kit gap]** Add our statuses to its map (§2.3)                                                                                                                                                                                                                                                                           |
| Detail pages                                                | `components/SingleView.svelte`, `SingleTable.svelte`, `Section.svelte`, `RowButton.svelte`                                                                                                                                                                                                                                                                                                          |
| Printable quote and receipt                                 | `components/PrintSheet.svelte` (rendered from a `+page@.svelte`)                                                                                                                                                                                                                                                                                                                                    |
| Copy a link (quote links, campaign links)                   | `Copy.svelte`                                                                                                                                                                                                                                                                                                                                                                                       |
| Empty and loading states                                    | `components/Empty.svelte`, `components/Loading.svelte`, shadcn `skeleton`                                                                                                                                                                                                                                                                                                                           |
| Reports and the Today board                                 | `components/reports/StatCard.svelte`, `ReportChart.svelte` (`Stat`, `ReportChartData`)                                                                                                                                                                                                                                                                                                              |
| Amounts                                                     | `global` `formatETB(amount, useAmharic)`, never a hand-rolled format                                                                                                                                                                                                                                                                                                                                |
| Dates                                                       | `global` (`formatEthiopianDate`, `formatEthiopianYearMonth`, `ethiopianRange`, …), `time` (`LOCAL_TIME_ZONE`, `localToday`, `localDayRange`, `addLocalDays`, `fromLocal`, `ethiopianClock`), `server/dates`, `expiry` (`expiryState`)                                                                                                                                                               |
| Files                                                       | `server/files` (`saveUploadedFile`, `resolveStoredFile`, `mimeFor`, `MAX_UPLOAD_BYTES`, `FILES_DIR`), `server/serveFile`, `server/fileAudit` `auditFiles(FILENAME_COLUMNS)`, `files` `fileUrl`                                                                                                                                                                                                      |
| Staff passwords                                             | `server/password`, `components/PasswordGenerator.svelte`                                                                                                                                                                                                                                                                                                                                            |
| Primitives                                                  | `components/ui/<name>/index.js` (34 shadcn components). Missing ones: `npx shadcn-svelte@latest add <x>` **into the kit**                                                                                                                                                                                                                                                                           |
| Styling                                                     | `styles/theme.css` (imported by `src/routes/layout.css`), `utils` `cn`, `global` class constants                                                                                                                                                                                                                                                                                                    |

### 2.3 Known kit gaps (add these to the kit)

**Closed so far (kit 0.1.2 → 0.1.9):** statuses map with our values and a `label` prop; `servePublicFile` + `publicFileUrl`; `createFileHandler({ canRead })`; `normalizePhone`/`isEthiopianPhone`/`localPhone` (`@nahu/admin-kit/phone`); `contentCrud` handles `WriteRefused`, passes `before` to `transform`, and takes `audit`; `FormDialog` `multipart`; `FileUpload` `labels`; `SelectComp` `placeholder`; `StatCard` `amharicMoney`; `Copy` no longer submits forms.
**Still open:** `SelectComp` inside a dialog or sheet — its option list is portalled outside the modal and hidden from screen readers (Amoria uses native selects there for now); `InputComp`'s `checkboxSingle` posts no value; kit labels are `capitalize`d (Amoria overrides it in `layout.css`).

| Gap                                                                                                                                                                                                                                                                                                                                                                                                                                  | Needed for                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `statuses.svelte` map: `pending_payment`, `preparing`, `ready`, `completed`, `expired`, `draft`, `sent`, `viewed`, `accepted`, `deposit_paid`, `declined`, `superseded`, `out`, `returned`, `overdue`, `open`, `closed`, `graduated`, `not_graduated`, `queued`, `sending`, `failed`, `initiated`, `success`, `new`, `contacted`, `quoted`, `won`, `lost`, `paid_unfulfillable`. Also a way to pass a **translated label** (Amharic) | every status shown                                       |
| **Public file serving:** a `servePublicFile` handler + `publicFileUrl(name)` that serve only names an app-supplied `isPublic(name)` accepts, with `Cache-Control: public, max-age=31536000, immutable`                                                                                                                                                                                                                               | product, package, portfolio and course images for guests |
| `DateRangePicker` / `DatePicker`: an `isDateUnavailable(date)` prop and optional Gregorian display (the storefront shows both calendars)                                                                                                                                                                                                                                                                                             | rental booking                                           |
| `InputComp` type `tel` with Ethiopian normalisation (`09…`, `9…`, `+2519…`, `07…` → `+251…`) + a server `normalizePhone`                                                                                                                                                                                                                                                                                                             | every contact form                                       |
| `LookupFieldType`: a paired bilingual text field (`name` / `nameAm`), or a documented pattern for two fields                                                                                                                                                                                                                                                                                                                         | every catalog form                                       |
| `FileUpload`: multiple files, and optional responsive variants (400/800/1600 WebP)                                                                                                                                                                                                                                                                                                                                                   | image galleries (launch with single files if not ready)  |
| A generic `LineItemsEditor` (description, qty, unit price, line total, sort; totals in birr)                                                                                                                                                                                                                                                                                                                                         | quote builder, later manual orders                       |
| `fileUrl` must not assume a signed-in viewer; the private route needs an app-supplied guard (`canRead(locals)`)                                                                                                                                                                                                                                                                                                                      | staff-only private files (§4.3)                          |

---

## 3. Hosting constraints (read before writing any server code)

**Target:** cPanel shared hosting, Node app via Passenger, **~2 GB RAM for the account**, and a MySQL/MariaDB instance we have limited control over.

### 3.1 The database is storage only

- ❌ No triggers, stored procedures, DB events or scheduled events, and no views that hold logic.
- ❌ No BLOBs. Files go on disk through the kit's `server/files`; the DB stores only the file name.
- ❌ Don't rely on `CHECK` constraints or DB-computed business values. zod validates and the app computes totals.
- ✅ Use InnoDB, primary keys, unique indexes, foreign keys (integrity only, `restrict`/`set null` as in the kit's mixins, **no `cascade`**; cascades are app code), plain indexes, and transactions with `SELECT … FOR UPDATE`.
- ✅ Column defaults the kit's mixins already use (`defaultNow()`, `ON UPDATE CURRENT_TIMESTAMP`) are fine.
- ✅ Keep to features that work on both MySQL 8 and MariaDB 10.6+:
  - Use `int().autoincrement()`, never `serial()` (MariaDB rejects it; delete the starter `task` table).
  - JSON only as opaque values (the kit's `listFields` store JSON arrays this way). Never query into them.
  - No `SKIP LOCKED` unless the host version is confirmed **[Verify on host]**.
- ✅ **UTC sessions:** copy dentalClinic's `db/connection.ts` (pool with `timezone: 'Z'` and `SET time_zone = '+00:00'` on each connection). "Today" always comes from the kit's `localToday()`, never `CURDATE()`.

### 3.2 No scheduled work outside the app

All background work runs **inside the app** through the job runner in §9. The only thing outside the app is a **trigger**: a cPanel cron `curl` (or uptime pinger) that calls `POST /api/jobs/tick`. It holds no logic. It exists because Passenger stops idle apps, and it is **required** (§9).

### 3.3 Protect the 2 GB server

| Rule                                          | Why and how                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Never build on the server**                 | Build locally or in CI and upload `build/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Bundle everything, ship no `node_modules`** | adapter-node bundles **devDependencies** and leaves `dependencies` external. **Move `@nahu/admin-kit` to `devDependencies`** so it and its dependencies are bundled and the server needs no `npm install`.                                                                                                                                                                                                                                                                                                                                             |
| **No native modules**                         | No `sharp`, `bcrypt` or `canvas`. Images are compressed in the browser by the kit's `FileUpload`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Cap the heap**                              | `NODE_OPTIONS=--max-old-space-size=512`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Small DB pool**                             | In `connection.ts`: `connectionLimit: 5, maxIdle: 2, idleTimeout: 60000, enableKeepAlive: true, queueLimit: 50`. Shared hosts cap `max_user_connections` **[Verify on host]**.                                                                                                                                                                                                                                                                                                                                                                         |
| **Session lookups off the DB**                | better-auth `session.cookieCache` (~5 min); skip `getSession` for asset paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Bounded in-memory cache**                   | `$lib/server/cache.ts`: TTL + max entries, for catalog lists, settings, permissions and the public-image name set. Invalidated from the CRUD `transform`/actions. Nothing unbounded or per-user.                                                                                                                                                                                                                                                                                                                                                       |
| **Lean queries**                              | Only needed columns; `data-table` server mode for every growing list; 24 per page on the storefront; `inArray` batching, no N+1; `notDeleted()` plus an index on every filter.                                                                                                                                                                                                                                                                                                                                                                         |
| **Prerender what's static**                   | About, contact, FAQ and policy pages: `export const prerender = true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Light storefront**                          | Storefront routes may use kit forms and primitives but not dashboard-only pieces (`ReportChart`/chart.js, `data-table`, `QueryBuilder`, papaparse).                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Lazy-load heavy server modules**            | `await import()` the email transport and Telegram client on first use (Passenger stops idle apps).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Body size**                                 | `BODY_SIZE_LIMIT=12M`, matching the kit's `MAX_UPLOAD_BYTES` (10 MB) plus form overhead.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Rate limiting in memory**                   | Token bucket per IP for login, sign-up, quote requests, checkout and webhooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **One app process**                           | The cache, rate limiter and click buffer are per process, and invalidation doesn't cross processes. Set Passenger to **one instance** (`PassengerMaxInstancesPerApp 1` / `PassengerMinInstances 1` in `.htaccess`, or the cPanel equivalent) **[Verify on host]**. Anything in memory can still be lost when Passenger stops or restarts the app, so memory may hold only what is safe to lose (caches) or is flushed often (clicks, §5.9). Prices, stock and availability are always re-read from the DB at write time, never trusted from the cache. |

### 3.4 Deploy checklist

1. `npm run check && npm test && npm run build` locally.
2. Upload `build/`, `package.json` and the `drizzle/` migrations.
3. Migrate. **[Decision]** Run `drizzle-kit migrate` locally against the host DB.
4. Restart the app from cPanel.
5. Smoke test: home, product, checkout to the payment page, dashboard login, job tick.

One-time host setup: the cron `curl` to `/api/jobs/tick` every minute (§9), and Passenger limited to one instance (§3.3).

Keep `FILES_DIR` **outside** the deploy folder so uploads survive redeploys, for example `~/amoria-files`. Backups use cPanel's backup (home directory including `FILES_DIR`, plus a DB dump), downloaded weekly.

### 3.5 Environment variables

`DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`, `FILES_DIR`, `CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`, `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_STAFF_CHAT_ID`, `JOBS_SECRET`, `NODE_OPTIONS`, `BODY_SIZE_LIMIT`.
Read them only through `$env/dynamic/private`, and list every one in `.env.example`.

---

## 4. Users, auth and access

### 4.1 Roles

| Role         | How created                                             | Can do                                                                          |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Guest**    | Nobody (no record)                                      | Everything customer-facing: buy, rent, request and accept quotes, register, pay |
| **Customer** | Optional self sign-up                                   | Everything a guest can, plus an **Account page**                                |
| **Staff**    | Created by admin in the dashboard (`PasswordGenerator`) | Dashboard sections allowed by their role's permissions                          |
| **Admin**    | Seeded                                                  | Everything (`isSuperAdmin`)                                                     |

**An account is optional, never required.** No page or flow may block a guest.

### 4.2 Customer accounts

- Sign up with email + password. **[Decision]** Phone + SMS OTP later.
- **`/account`** shows:
  - Orders, rentals, quotes and registrations, with status (kit `statuses`) and links to `/o/…`, `/r/…`, `/q/…`, `/reg/…`
  - Paying outstanding amounts
  - Saved contact details and address, pre-filled at checkout
  - Language preference
  - Connect Telegram
  - Built with `SingleView`, `Section`, `FormCard` and `InputComp`
- **Linking guest history:** the `customer` row is created on the first guest purchase, keyed by normalised phone number. Both that phone and the row's `email` are **unverified guest input**, so a verified email must never link a whole `customer` row. Otherwise someone could check out with a victim's phone and their own email, sign up with that email, and see the victim's history.
  - `/account` shows only records that are **proven** to belong to the user: records created while signed in, plus guest records whose **snapshot** `contactEmail` equals the user's verified email (matched per record, never per `customer` row).
  - `customer.userId` is set, and the whole phone-keyed history is shown, only after phone OTP **[Decision]** or manual linking by staff.
- **Privacy:** checkout never reveals or pre-fills anything from a phone number a guest types. Pre-fill comes only from the signed-in user's own customer record.

### 4.3 Must-fix in the current scaffold (do these first)

1. `hooks.server.ts` treats **every signed-in user as super admin**. Replace the `permissions` callback with dentalClinic's approach: resolve `permList` from the role and special permissions, and compute `isSuperAdmin` in the app. Customers get `permList: []` and `isSuperAdmin: false`.
2. `/dashboard/+layout.server.ts` must refuse anyone who isn't staff (send customers to `/account`).
3. `/dashboard/files/[name]` serves to **any** signed-in user, which now includes customers. Guard it for staff. **[Kit gap]** Add `canRead` to `serveFile`.
4. `user.role` is never settable from sign-up input (better-auth `additionalFields` with `input: false`).
5. Delete the `task` table and `/demo` routes, point `configureKit({ loginPath })` at `/login`, and pass `auditLog`.
6. ~~Run `npm run auth:schema`~~ **Done differently:** as in dentalClinic, the better-auth tables are hand-declared in `schema/auth.ts`, because `user` carries Amoria's own columns and the generator would overwrite them. Anything better-auth must see is repeated under `user.additionalFields` in `auth.ts`. The `schema/` folder layout is in place.

### 4.4 Permissions (dentalClinic model)

- Tables: `roles`, `permissions`, `role_permissions`, `special_permissions` (§5.1).
- Permission names are constants in `$lib/permissions.ts`, **synced into `permissions` once per boot** (idempotent and additive), the same as dentalClinic's `hooks.server.ts`. Names include `orders.view`, `orders.manage`, `rentals.manage`, `quotes.manage`, `quotes.send`, `school.manage`, `catalog.manage`, `stock.adjust`, `payments.record`, `customers.view`, `reports.view`, `links.manage`, `messages.view`, `settings.manage` and `staff.manage`.
- Every dashboard route gets an `access.ts` rule and a `navigation.ts` entry. Every action beyond the page's own gate calls `requirePermission` (or passes `permission` to `childCrud`). Every delete calls `requireSuperAdmin`.

---

## 5. Data model

### 5.0 Conventions (apply to every table)

- **Layout:** `src/lib/server/db/schema/<domain>.ts`, re-exported from `schema/index.ts`. `schema/secureFields.ts` exports the kit's `fieldMixins(() => user.id)`. Update `drizzle.config.ts` to point at the folder.
- **Names:** SQL tables `snake_case`, Drizzle properties camelCase, using the plural or singular style dentalClinic uses for the same kind of table (`roles`, `permissions`). Pick one per domain and keep it.
- **Keys:** `int('id').autoincrement().primaryKey()`. Auth tables keep better-auth's string IDs; FKs to `user.id` are `varchar(255)` as in the kit's mixins.
- **Mixins:**
  - `secureFields` on content that staff edit (products, packages, courses, portfolio, campaign links)
  - `lesserFields` on lookups (categories, event types)
  - Transactional records (orders, bookings, quotes, payments, registrations, messages) are **never deleted**. They end as `cancelled` or `expired`. They get `createdAt`/`updatedAt` columns defined like `secureFields` does, with no soft delete.
- **Money:** **birr as `decimal(12, 2, { mode: 'number' })`**, the same as dentalClinic. It's shown with `formatETB` and entered through the kit's `money` field type. Round every computed amount with one helper, `roundBirr(n) = Math.round(n * 100) / 100`, and compute totals **only** in services.
- **Time:** instants are `timestamp`/`datetime` in UTC (UTC sessions, §3.1). Business days (event date, rental start/end, intake start) are `date` columns meaning the Addis Ababa day, handled through kit `time` helpers. Display them with the kit's Ethiopian helpers; the storefront shows both calendars.
- **Snapshots:** anything a customer paid for copies the name, price and contact details at the time of purchase.
- **Public tokens:** `order`, `rental_booking`, `quote` and `registration` have `publicToken varchar(32)` unique (128 random bits, base64url), used in `/o/`, `/r/`, `/q/`, `/reg/`. Numeric IDs are never exposed publicly.
- **Human numbers:** `ref varchar(20)` unique, formatted from the ID after `insertReturningId` (e.g. `AM-O-000123`).
- **Bilingual content:** pairs of columns (`name`, `nameAm`), with `nameAm` nullable and falling back to English through one `localized(row, 'name')` helper.
- **Lists entered one per line** (package inclusions, course curriculum points) use `contentCrud`'s **`listFields`** (a JSON string array).
- **Files:** a `varchar(64)` filename from the kit's `saveUploadedFile`, and nothing else. Every filename column goes into the app's `FILENAME_COLUMNS` list for `auditFiles`.
- **Statuses:** `mysqlEnum`, with every value list in `src/lib/constants.ts` (shared by the schema, zod and the status badges). Schema files import it by relative path, because drizzle-kit can't resolve `$lib`. Status changes happen only in the owning service function (§6).
- **JSON:** `jsonText` from `schema/columns.ts` (LONGTEXT). MariaDB's `JSON` type adds a `CHECK` constraint that drizzle-kit can't introspect.
- **Soft delete:** every read of a mixin table uses `notDeleted(...)`, in the `on` clause for joins.
- **Audit:** the kit's `audit_log`, passed to `configureKit`. Audit prices, quotes, payments, stock adjustments and roles/permissions. Pass `audit` to `childCrud` where it applies. Don't audit high-churn tables.

### 5.1 Identity and permissions

**`user`** (better-auth) with `additionalFields`: `role` enum `customer`/`staff`/`admin` (default `customer`, `input: false`), `roleId` int FK → `roles` (staff), `phone varchar(20)`, `locale` enum `en`/`am`, `telegramChatId varchar(32)`, plus the `deletionFields` columns written inline (as dentalClinic does for `user`).

**`roles`**: `id`, `name` unique, `description`, plus the deletion columns inline.
**`permissions`**: `id`, `name varchar(50)` unique, `description`. Synced from code.
**`role_permissions`**: `id`, `roleId` FK, `permissionId` FK, `...secureFields`.
**`special_permissions`**: `id`, `userId` FK, `permissionId` FK, `...secureFields`.
(These FKs are `restrict`, not dentalClinic's `cascade`. Removing a role or permission clears its links in app code.)

**`customer`**

| Column                   | Type                   | Notes                                        |
| ------------------------ | ---------------------- | -------------------------------------------- |
| `id`                     | int PK                 |                                              |
| `userId`                 | varchar(255) FK → user | unique, nullable. Set when linked            |
| `name`                   | varchar(120)           |                                              |
| `phone`                  | varchar(20)            | unique, normalised. The key for guest upsert |
| `email`                  | varchar(190)           | nullable, indexed                            |
| `telegramUserId`         | varchar(32)            | unique, nullable                             |
| `telegramChatId`         | varchar(32)            | nullable                                     |
| `locale`                 | enum `en`, `am`        |                                              |
| `defaultAddress`         | varchar(255)           | nullable                                     |
| `createdAt`, `updatedAt` |                        |                                              |

Guest checkout upserts by phone but never overwrites a linked customer's name or email. The record's snapshot holds what was typed. `customer.email` is a contact hint only, never an identity: nothing links or authorises through it (§4.2).

### 5.2 Catalog and media

**`category`** (lookup: `LookupPage` + `contentCrud`): `id`, `kind` enum `gift`/`rental`, `slug` unique, `name` unique per kind, `nameAm`, `parentId` (nullable, `reference` field), `sortOrder`, `...lesserFields`.

**`product`** holds gifts and rental equipment in one stock list (`contentCrud` with `references: [category]`).

| Column                         | Type                  | Notes                                                                                                                      |
| ------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | int PK                |                                                                                                                            |
| `kind`                         | enum `gift`, `rental` |                                                                                                                            |
| `categoryId`                   | FK → category         |                                                                                                                            |
| `slug`                         | varchar(160)          | unique (`uniqueField`)                                                                                                     |
| `name`, `nameAm`               | varchar(160)          |                                                                                                                            |
| `description`, `descriptionAm` | text                  |                                                                                                                            |
| `price`                        | decimal               | gift sale price (null for rental)                                                                                          |
| `dailyRate`                    | decimal               | rental (null for gift)                                                                                                     |
| `deposit`                      | decimal               | rental security deposit, default 0 **[Decision]**                                                                          |
| `minRentalDays`                | int                   | default 1                                                                                                                  |
| `stockQty`                     | int                   | gift: units on hand. Rental: units owned. **Written only by `stock.ts`, never by the CRUD form** (strip it in `transform`) |
| `lowStockThreshold`            | int                   |                                                                                                                            |
| `isFeatured`                   | bool                  |                                                                                                                            |
| `publishedAt`                  | datetime              | null means hidden; recent means "new arrival"                                                                              |
| `sortOrder`                    | int                   |                                                                                                                            |
| `...secureFields`              |                       | `isActive` is the on/off switch                                                                                            |

Indexes: `(kind, categoryId, publishedAt)` and `(isFeatured)`.

**Images:** one child table per owner, so each is a plain **`childCrud`** with `fileFields: ['fileName']`, owner-scoped and owner-checked on delete.

- `product_image` (`productId`), `package_image` (`packageId`), `portfolio_image` (`portfolioItemId`), `course_image` (`courseId`)
- Each has `id`, the owner FK, `fileName varchar(64)`, `alt`, `altAm`, `sortOrder` and `...deletionFields`
- Index `(ownerId, sortOrder)`
- Upload through the kit's `FileUpload` (browser compression to ≤1 MB and ≤1920 px, already in the kit)
- Serve publicly through the **[Kit gap]** public file handler, where `isPublic(name)` checks a cached set of filenames from these four tables. Private files stay on `/dashboard/files`.

**`stock_movement`** is an append-only ledger: `id`, `productId` FK, `delta int`, `reason` enum `sale`/`sale_cancel`/`delivery`/`damage`/`loss`/`adjustment`/`opening`, `refType varchar(20)`, `refId int`, `note`, `createdBy`, `createdAt`. Index `(productId, createdAt)`.
`stock.move()` writes the movement and updates `product.stockQty` in the same transaction, locking the product row. Rental availability comes from bookings (§5.4); movements change rental stock only when units are bought, damaged or lost.

**Site-wide and extensible.** One ledger for every kind of product (gifts, rental equipment, and whatever comes next). Each reason's meaning — direction, and whether staff may record it by hand — is one entry in `STOCK_REASON_META` (`$lib/stock.ts`); a new _source_ of movements (rentals out and back, décor jobs using materials) calls `stock.move()` with its own `refType` and adds one line to `STOCK_REF_LINKS`. Staff changes go through `stock.adjustStock()`: a reason with a quantity, or a stock count (the difference is recorded as a correction). The dashboard's Stock → Levels and Ledger pages, and each product's page, read the same ledger.

### 5.3 Gift shop orders

**`order`** (SQL table `orders`: `ORDER` is a reserved word)

| Column                                        | Type                                                                                                            | Notes                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `id`, `ref`, `publicToken`                    |                                                                                                                 |                                            |
| `customerId`                                  | FK                                                                                                              |                                            |
| `contactName`, `contactPhone`, `contactEmail` |                                                                                                                 | snapshot                                   |
| `fulfilment`                                  | enum `pickup`, `delivery`                                                                                       | customer's choice at checkout              |
| `deliveryAreaId`, `deliveryAreaName`          | FK → delivery_area, varchar                                                                                     | delivery only; name snapshotted            |
| `deliveryAddress`                             | varchar(255)                                                                                                    | street, building, landmark as typed        |
| `subtotal`, `deliveryFee`, `total`            | decimal                                                                                                         |                                            |
| `status`                                      | enum `pending_payment`, `paid`, `preparing`, `ready`, `completed`, `cancelled`, `expired`, `paid_unfulfillable` | `paid_unfulfillable`: late payment, see §7 |
| `holdExpiresAt`, `paidAt`                     | datetime                                                                                                        |                                            |
| `sourceId`                                    | FK → traffic_source                                                                                             | nullable                                   |
| `locale`, `notes`, `createdAt`, `updatedAt`   |                                                                                                                 |                                            |

Indexes: `(status, holdExpiresAt)`, `(customerId, createdAt)`.

**`order_item`**: `id`, `orderId` FK, `productId` FK, `nameSnapshot`, `unitPrice`, `qty`, `lineTotal`.

- **Stock rule:** stock is reserved when the order is created (a `sale` movement with product rows locked) and held for `settings.holdMinutes` (default 30). An expired unpaid order gets `sale_cancel` movements. "Sold out" means `stockQty <= 0`.
- **Cart:** there are no cart tables. The bag lives in the browser (`localStorage`, max 20 lines) and is posted with the checkout, where every product, price and stock level is re-read under lock. (Changed from a signed cookie: checkout happens in a sheet on the shop page, so the server never needs the bag between requests. `/buy/[slug]` redirects to `/shop?add=<slug>`.)
- **Delivery (fixtec's model):** `delivery_area` (`name`, `nameAm`, `fee`, `sortOrder`, `lesserFields`; a `LookupPage`) holds where the shop delivers and the fee there. Settings `freeDeliveryThreshold` (0 = off) and `freeDeliverySuggestAt` (the bag shows "add ETB X for free delivery" above it). The rule is one function in `$lib/delivery.ts`, shown in the sheet and charged by `services/delivery.ts`; the server never takes a fee from the form.
- **Transfers:** `bank_account` (`bankName`, `accountName`, `accountNumber`, `sortOrder`, `lesserFields`) lists where customers transfer to. Checkout shows each with a one-tap copy of the number (and of the amount); the customer picks the account and uploads the receipt, which becomes a `payment` (`bank_transfer`, `initiated`, `bankAccountId`, `receiptFile`) that holds the order until staff confirm it.

### 5.4 Equipment rental

**`rental_booking`**: `id`, `ref`, `publicToken`, `customerId`, contact snapshot, `startDate`, `endDate` (date, inclusive), `days`, `subtotal`, `deposit`, `total`, `status` enum `pending_payment`/`confirmed`/`out`/`returned`/`cancelled`/`expired`/`paid_unfulfillable` (§7), `holdExpiresAt`, `paidAt`, `pickedUpAt`, `returnedAt`, `reminderSentAt`, `returnNote`, `sourceId`, timestamps.
Indexes: `(status, endDate)` and `(startDate, endDate)`.
**Overdue** is derived, not stored: `status = 'out' AND endDate < localToday()`, in one helper, shown by the kit's `statuses` as `overdue`.
**Security deposit refunds are not designed yet.** While `deposit` defaults to 0 nothing is needed. Before any product gets a non-zero deposit, decide how it is returned (Chapa refund API, cash at return, or bank transfer) and how it is recorded (a refund `payment` row, or a `depositReturnedAt` column) **[Decision]**.

**`rental_booking_item`**: `id`, `bookingId` FK, `productId` FK, `nameSnapshot`, `qty`, `dailyRateSnapshot`, `lineTotal`. Index `(productId, bookingId)`.

**No double-booking** is enforced by the app, in one transaction:

1. Lock the product rows (`FOR UPDATE`).
2. Sum `qty` of overlapping items, where `start <= req.end AND end >= req.start` and status is in (`confirmed`, `out`) or is an unexpired `pending_payment`.
3. Refuse with `WriteRefused` if `booked + requested > stockQty`.

`rentals.availability(productId, month)` feeds both this check and the calendar's `isDateUnavailable` **[Kit gap]**.

### 5.5 Décor services and quotes

**`event_type`** (lookup): `id`, `slug`, `name`, `nameAm`, `sortOrder`, `...lesserFields`. Seed with wedding, birthday, engagement, baby shower, graduation, corporate and other.

**`decor_package`** (`contentCrud`, `listFields: ['inclusions', 'inclusionsAm']`): `id`, `slug`, `eventTypeId`, `tier` enum `basic`/`premium`/`luxury`, `name`, `nameAm`, `summary`, `summaryAm`, `inclusions`, `inclusionsAm`, `startingPrice` (decimal), `keyword varchar(20)` (e.g. `BIRTHDAY`), `sortOrder`, `...secureFields`.

**`portfolio_item`** (`contentCrud`): `id`, `slug`, `title`, `titleAm`, `eventTypeId`, `eventDate`, `venue`, `description`, `descriptionAm`, `isFeatured`, `sortOrder`, `...secureFields`.

**`quote_request`** is what the customer submits: `id`, `publicToken`, `customerId`, contact snapshot, `eventTypeId`, `eventDate`, `venue`, `guestCount`, `theme`, `budget` (decimal, nullable), `packageId` (nullable), `message`, `preferredChannel` enum `whatsapp`/`telegram`/`sms`/`email`/`phone`, `status` enum `new`/`contacted`/`quoted`/`won`/`lost`, `assignedTo` FK → user, `sourceId`, timestamps. Index `(status, createdAt)`.

**`quote`** is what staff build (never automatic).

| Column                                | Type                                                                                                                 | Notes                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `id`, `ref`, `publicToken`            |                                                                                                                      |                                                                          |
| `quoteRequestId`                      | FK                                                                                                                   | nullable (staff can quote straight from a chat)                          |
| `customerId`, contact snapshot        |                                                                                                                      |                                                                          |
| `eventTypeId`, `eventDate`, `venue`   |                                                                                                                      |                                                                          |
| `subtotal`, `discount`, `total`       | decimal                                                                                                              |                                                                          |
| `depositDue`                          | decimal                                                                                                              | default `total × settings.depositPercent` (50%) **[Decision]**, editable |
| `amountPaid`                          | decimal                                                                                                              | sum of successful payments                                               |
| `status`                              | enum `draft`, `sent`, `viewed`, `accepted`, `deposit_paid`, `paid`, `declined`, `expired`, `cancelled`, `superseded` |                                                                          |
| `validUntil`                          | date                                                                                                                 | shown with the kit's `expiry-cell`                                       |
| `sentAt`, `viewedAt`, `acceptedAt`    | datetime                                                                                                             | `viewedAt` is set only by the view beacon (§11), never by the page load  |
| `supersededById`                      | FK → quote                                                                                                           | a revision is a new quote                                                |
| `customerNote`, `internalNote`        | text                                                                                                                 |                                                                          |
| `createdBy`, `createdAt`, `updatedAt` |                                                                                                                      |                                                                          |

Indexes: `(status, eventDate)`, `(customerId)`.

**`quote_item`** (`childCrud`, owner `quoteId`, editable only while the quote is `draft`, which `transform` enforces with `WriteRefused`): `id`, `quoteId`, `description`, `descriptionAm`, `qty`, `unitPrice`, `lineTotal`, `sortOrder`, `...deletionFields`.

The **event calendar** is quotes with status `deposit_paid` or `paid`, by `eventDate`.

### 5.6 Décor school

**`course`** (`contentCrud`, `listFields: ['curriculum', 'curriculumAm']`): `id`, `slug`, `title`, `titleAm`, `summary`, `summaryAm`, `curriculum`, `curriculumAm`, `fee` (decimal), `durationText`, `sortOrder`, `...secureFields`.

**`course_intake`** (`childCrud`, owner `courseId`): `id`, `courseId`, `startDate`, `endDate`, `scheduleText`, `seatLimit`, `status` enum `open`/`closed`/`completed`/`cancelled`, `...deletionFields`, timestamps. Index `(courseId, status, startDate)`.

**`registration`**: `id`, `ref`, `publicToken`, `intakeId`, `customerId`, contact snapshot, `feeSnapshot`, `status` enum `pending_payment`/`confirmed`/`cancelled`/`expired`/`paid_unfulfillable` (§7), `holdExpiresAt`, `paidAt`, `result` enum `pending`/`graduated`/`not_graduated` (Phase 2), `resultNotifiedAt`, `sourceId`, timestamps. Index `(intakeId, status)`.

**Seats left** = `seatLimit − confirmed − unexpired pending`, checked with the intake row locked.

### 5.7 Payments

**`payment`**: `id`, `txRef varchar(64)` unique, `provider` enum `chapa`/`telebirr`/`cash`/`bank_transfer`, `providerRef`, `purpose` enum `order`/`rental`/`quote_deposit`/`quote_balance`/`registration`, nullable FKs `orderId`, `rentalBookingId`, `quoteId`, `registrationId` (**exactly one set**, checked in the service), `amount` (decimal), `status` enum `initiated`/`success`/`failed`/`cancelled`, `checkoutUrl varchar(500)`, `verifiedAt`, `verifyPayload text` (truncated), `receiptFile varchar(64)` (manual payments, private kit store), `recordedBy` FK → user, timestamps. Indexes: `(status, createdAt)`, plus each FK.

### 5.8 Messaging (outbox)

**`message`**: `id`, `channel` enum `sms`/`email`/`telegram`, `recipient`, `template varchar(50)`, `locale`, `params text` (opaque JSON), `status` enum `queued`/`sending`/`sent`/`failed`, `attempts tinyint`, `nextAttemptAt`, `lastError varchar(255)`, `providerMessageId`, `relatedType`, `relatedId`, `createdAt`, `sentAt`. Index `(status, nextAttemptAt)`. Retry with backoff at 1, 5 and 30 minutes, then `failed` and a staff alert.

### 5.9 Attribution and campaign links

**`traffic_source`**: `id`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `refCode`, unique on all five. The five are `NOT NULL DEFAULT ''`, because a unique index never matches rows whose key contains NULL. It's upserted at conversion from the first-touch cookie `am_src` (30 days, set in `hooks.server.ts`). Every order, booking, quote request and registration stores `sourceId`.

**`campaign_link`** (`contentCrud` + `Copy` for the link): `id`, `code varchar(16)` unique, `label`, `targetPath`, UTM fields, `refCode`, `clicks int`, `...secureFields`.

- `/l/[code]` sets the cookie and redirects.
- Clicks are counted in memory and flushed about every 60 seconds by the job runner.

### 5.10 System

**`setting`**: `key varchar(64)` PK and `value text`. It's typed by a zod schema in `settings.ts`, cached, and edited on one `FormCard` page. Keys:

- Hold and quote timing: `holdMinutes`, `quoteValidDays`, `rentalReminderDays`
- Money defaults: `depositPercent`, `lowStockDefault`, `deliveryEnabled`, `freeDeliveryThreshold`, `freeDeliverySuggestAt` (per-area fees live in `delivery_area`)
- Contact details: `businessPhone`, `whatsappNumber`, `telegramUsername`, `businessEmail`, `address`, `mapUrl`
- Staff alerts: `staffAlertChatId`

**`job_lock`**: `name varchar(64)` PK, `lockedUntil datetime`, `lastRunAt datetime`, `lastError varchar(255)`.

**`audit_log`**: the kit's columns (`userId`, `action`, `tableName`, `recordId`, `changes`, `ipAddress`, `branchId`, `createdAt`). `branchId` stays null; Amoria has one site.

---

## 6. Server architecture

```
src/lib/server/
  db/
    connection.ts     UTC pool (copied from dentalClinic) + §3.3 pool limits
    dialect.ts        today() and SQL helpers, as dentalClinic
    index.ts          drizzle(pool, { schema })
    schema/           <domain>.ts files, secureFields.ts, index.ts
  auth.ts             better-auth (+ cookieCache, additionalFields)
  permissions.ts      computeIsSuperAdmin, permission sync (dentalClinic pattern)
  services/           Business logic that isn't plain CRUD
    customers.ts      upsertGuest, linkToUser, profile
    catalog.ts        cached public reads (products, packages, courses, images)
    stock.ts          move() — the ONLY writer of stockQty
    orders.ts         createFromCart, markPaid, expireHolds, transitions
    rentals.ts        availability, book, markPaid, pickUp, markReturned, expireHolds
    quotes.ts         submitRequest, send, view, accept, markPaid, revise
    school.ts         seatsLeft, register, markPaid, setResult
    payments/         index.ts (pipeline), payable.ts, chapa.ts, manual.ts
    messaging/        outbox.ts, send.ts, providers/{sms,email,telegram}.ts, templates/*.ts
    telegram/         bot.ts (webhook), miniapp.ts (initData verification)
    attribution.ts    cookie ↔ traffic_source, campaign links, click buffer
    settings.ts       typed and cached
    jobs/             runner.ts, registry.ts, one file per job
  cache.ts            bounded TTL cache + invalidate(tag)
  rateLimit.ts        in-memory token bucket
  tokens.ts           publicToken(), ref formatting
  files.ts            FILENAME_COLUMNS for auditFiles, isPublic(name) for public images
```

**Rules**

- **Plain CRUD** (catalog, lookups, packages, courses, intakes, images, campaign links, settings) is `contentCrud` / `childCrud` directly, with no service in between. Put server-decided columns in `transform`, and refuse with `WriteRefused`.
- **State changes** (paid, sent, picked up, expired…) are one service function each. It opens a transaction, checks the current status, writes, enqueues messages (outbox, same transaction) and calls `recordAudit`. Illegal transitions throw `WriteRefused`. DB failures go through `hideFailure`.
- Services take validated plain inputs, never a `RequestEvent`.
- Every service function has tests using the kit's `server/testing/rollback`.

---

## 7. The shared payment pipeline

Every sellable record implements one interface:

```ts
interface Payable {
	kind: 'order' | 'rental' | 'quote_deposit' | 'quote_balance' | 'registration';
	findByToken(token: string): Promise<PayableView | null>; // amount due, title, contact, status
	onPaid(tx: Writer, id: number, payment: Payment): Promise<void>; // Writer from @nahu/admin-kit/server/db
	onExpired?(tx: Writer, id: number): Promise<void>;
}
```

```
create record (pending_payment + hold) ──► payments.start(kind, id)
      │                                      payment(initiated, txRef) → Chapa initialize → redirect
      ▼
Chapa checkout ──► webhook /api/payments/chapa/webhook ─┐
             └──► return  /pay/return?tx_ref=…          ├─► payments.verify(txRef)
job: reconcile initiated payments > 10 min ─────────────┘    Chapa verify API (never trust a callback alone)
                                                              idempotent → Payable.onPaid once
```

- **Provider:** Chapa by default (it covers telebirr, CBE Birr and cards). **[Decision]**
- **Idempotent:** a second webhook or return visit is a no-op.
- **Late payments:** a verified payment can arrive after `expire-holds` has already expired its record and released the stock, dates or seat. Money that Chapa has verified is **never ignored**. The `payment` row is always marked `success`. Then, in the same transaction as `onPaid`:
  1. If the record is `expired`, `onPaid` tries to **re-reserve**, using the same locked check as the original booking: stock for orders, overlap for rentals, seats for registrations. If it succeeds, the record moves to its paid status as normal.
  2. If re-reserving fails, the record moves to **`paid_unfulfillable`** (added to each payable's status enum and the kit statuses map). Staff get an urgent Telegram alert with a link to the record, and the customer gets "We received your payment; we'll call you to rebook or refund." Staff resolve it by hand (rebook or refund).
  3. `cancelled` records follow the same rule. A quote that has `expired` or been `superseded` accepts the payment and alerts staff.
- **Payments only for live records:** `payments.start` refuses (`WriteRefused`) records that are not `pending_payment`, or whose hold has less than about 2 minutes left. In that case it first extends the hold only if stock or availability still allows it. This makes late payments rare, but they still have to be handled.
- **Security:** webhook signatures are checked. Amounts always come from the DB, never from the client.
- **Manual payments:** staff record cash or bank transfer (with a receipt through the kit's `FileUpload`, stored privately) using a `FormDialog`, which calls the same `onPaid`.

---

## 8. Messaging

- Everything goes through `outbox.enqueue({ channel, to, template, params, locale, related })` inside the causing transaction, and the job runner sends it.
- Templates are per locale in `messaging/templates/`, returning `{ sms, emailSubject, emailHtml, telegram }`. Amounts use `formatETB` and dates use the kit's Ethiopian helpers. SMS stays short (70 characters per Unicode segment for Amharic), so links use `/q/[token]`.
- Providers sit behind one interface each:
  - **SMS:** Ethiopian gateway (AfroMessage or GeezSMS) **[Decision]**
  - **Email:** cPanel SMTP (check its hourly limit **[Verify on host]**)
  - **Telegram:** Bot API

| Trigger                                  | Customer                                 | Staff (Telegram group)        |
| ---------------------------------------- | ---------------------------------------- | ----------------------------- |
| Order paid                               | SMS + email (+ Telegram)                 | alert with dashboard link     |
| Rental paid                              | SMS + email                              | alert                         |
| Rental due (`rentalReminderDays` before) | SMS                                      | —                             |
| Rental overdue                           | —                                        | daily digest                  |
| Quote request                            | acknowledgement                          | alert                         |
| Quote sent                               | SMS + email + Telegram with `/q/[token]` | —                             |
| Quote viewed, accepted or paid           | confirmation on paid                     | alert on each                 |
| Registration paid                        | SMS + email                              | alert                         |
| Course result (Phase 2)                  | SMS + email                              | —                             |
| Low stock                                | —                                        | alert (once per item per day) |
| Message failed 3× / verify failed        | —                                        | alert                         |

---

## 9. Background jobs (in-app, no DB events)

**Runner:** a registry of `{ name, everySeconds, run }`. `maybeRunDueJobs()` is:

1. **Piggybacked on requests** from `hooks.server.ts`, without awaiting and throttled to once per 30 seconds per process. It never delays a response.
2. **Pinged every minute** at `POST /api/jobs/tick` with `JOBS_SECRET` by a cPanel cron `curl` (or an uptime pinger). This is **required**. Passenger stops idle apps, so with request piggybacking alone, hold expiry, reminders, message sending and the 08:00 digest would run only when a visitor happens to arrive. The ping also wakes the app. The runner must still work without it (piggybacking), but production is not considered set up until the cron exists (§3.4).

**Locking:** `UPDATE job_lock SET locked_until = NOW() + INTERVAL ? SECOND WHERE name = ? AND (locked_until IS NULL OR locked_until < NOW())`. If it affects exactly 1 row, the job is ours. Every job is idempotent and runs in bounded batches of about 50.
**Seeding:** the `UPDATE` matches nothing if a job's row is missing, and the job would then silently never run. At boot, the runner does `INSERT IGNORE` of one `job_lock` row per registry entry (the same pattern as the permission sync), and `/api/jobs/tick` reports each job's `lastRunAt`/`lastError`.

| Job                  | Every              | Does                                                                             |
| -------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `send-messages`      | 30 s               | send due outbox rows                                                             |
| `expire-holds`       | 1 min              | `Payable.onExpired` for unpaid orders, rentals and registrations                 |
| `reconcile-payments` | 5 min              | verify stale `initiated` payments                                                |
| `flush-link-clicks`  | 1 min              | write buffered clicks                                                            |
| `rental-reminders`   | 1 h                | queue return reminders once                                                      |
| `expire-quotes`      | 1 h                | `sent`/`viewed` past `validUntil` → `expired`                                    |
| `staff-digest`       | daily, 08:00 Addis | overdue rentals, low stock, today's events and pickups                           |
| `cleanup`            | daily              | expired better-auth sessions and verifications, sent messages older than 90 days |
| `audit-files`        | weekly             | kit `auditFiles(FILENAME_COLUMNS)`, reporting orphans to staff                   |

---

## 10. Routes

Public routes are localized by Paraglide (`/…` for English, `/am/…` for Amharic). They're SSR'd with `<title>`, meta description and an Open Graph image, so links preview correctly on Telegram, WhatsApp and Facebook.

| Route                                                                             | Purpose                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                               | Home: the four businesses, featured and new products, packages, next intake, portfolio, chat buttons                                                    |
| `/shop`, `/shop/[category]`                                                       | Gift catalogue with search and filters, paginated                                                                                                       |
| `/p/[slug]`                                                                       | Product page                                                                                                                                            |
| `/buy/[slug]`                                                                     | **Direct-buy link:** puts the item in the cart cookie and redirects to `/checkout`                                                                      |
| `/cart`, `/checkout`                                                              | Guest checkout (`createForm` + `InputComp`)                                                                                                             |
| `/rent`, `/rent/[category]`, `/rent/book/[slug]`                                  | Rental catalogue and booking (date range, live price, contact, pay)                                                                                     |
| `/decor`, `/decor/packages/[slug]`, `/decor/portfolio`, `/decor/portfolio/[slug]` |                                                                                                                                                         |
| `/decor/quote`                                                                    | Quote request (pre-filled from `?package=`)                                                                                                             |
| `/school`, `/school/[slug]`, `/school/register/[intakeId]`                        | Courses, intakes with seats left, registration                                                                                                          |
| `/o/[token]`, `/r/[token]`, `/reg/[token]`                                        | Status pages (pay again if pending)                                                                                                                     |
| `/q/[token]`                                                                      | Quote page: itemised, accept, pay deposit or balance, no login. `/q/[token]/print` uses `PrintSheet`; `POST /q/[token]/viewed` is the view beacon (§11) |
| `/pay/return`                                                                     | Verify, then redirect to the status page                                                                                                                |
| `/l/[code]`                                                                       | Campaign short link                                                                                                                                     |
| `/media/[name]`                                                                   | Public images (**[Kit gap]** public file handler)                                                                                                       |
| `/tg`                                                                             | Telegram mini app entry                                                                                                                                 |
| `/login`, `/signup`, `/account/**`                                                | Optional customer account                                                                                                                               |
| `/about`, `/contact`, `/faq`, `/terms`, `/privacy`                                | Prerendered                                                                                                                                             |
| `/sitemap.xml`, `/robots.txt`                                                     | Generated                                                                                                                                               |
| `/api/payments/chapa/webhook`, `/api/telegram/webhook`, `/api/jobs/tick`          | Machine endpoints (signature or secret checked, rate limited)                                                                                           |

**Dashboard** (`/dashboard/**`, staff only, kit shell). Every page has an `access.ts` rule, a `navigation.ts` entry, and an `ENTITIES` route where records link to it.

| Page                       | Built with                                                                                                                         | Launch               | Phase 2                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------- |
| **Today**                  | `StatCard`s + short `data-table`s (new orders, pickups/returns, new requests, unpaid quotes, today's events, low stock)            | ✅                   |                                 |
| Orders                     | `data-table` server mode + `QueryBuilder`; detail `SingleView`/`Section`/`SingleTable`; status and manual payment via `FormDialog` | ✅                   |                                 |
| Rentals                    | same; calendar view                                                                                                                | ✅ list and calendar | return, due and overdue screens |
| Quote requests             | `data-table` server mode, detail + "Build quote"                                                                                   | ✅                   |                                 |
| Quotes + **Quote builder** | `SingleView` + `LineItemsEditor` **[Kit gap]** on `childCrud` + `Copy` link + `PrintSheet`                                         | ✅                   |                                 |
| Event calendar             | paid quotes                                                                                                                        | ✅                   |                                 |
| School                     | `contentCrud` courses; `childCrud` intakes; students `data-table`                                                                  | ✅                   | results + notify                |
| Catalog                    | products `contentCrud` + images `childCrud`; categories `LookupPage`                                                               | ✅                   |                                 |
| Décor                      | packages and portfolio `contentCrud` + images; event types `LookupPage`                                                            | ✅                   |                                 |
| Stock                      | levels `data-table`, adjust `FormDialog`, movements `data-table`                                                                   | automatic updates    | full screens                    |
| Customers                  | `data-table` + detail                                                                                                              | basic                | history                         |
| Campaign links             | `contentCrud` + `Copy` + click/conversion columns                                                                                  | ✅                   |                                 |
| Reports                    | `StatCard` + `ReportChart` by period, business and source                                                                          |                      | ✅                              |
| Messages                   | outbox `data-table`, retry action                                                                                                  | ✅                   |                                 |
| Settings                   | `FormCard`                                                                                                                         | ✅                   |                                 |
| Staff and roles            | users + `PasswordGenerator`; roles `LookupPage`; permissions matrix                                                                | ✅                   |                                 |

---

## 11. Key flows

**Quote (the core décor flow)**

1. A customer submits `/decor/quote`, or staff create a request from a WhatsApp/Telegram chat. Staff get a Telegram alert.
2. Staff open the **Quote builder**. It's one screen:
   - Details come pre-filled from the request.
   - Line items can start from a package's `inclusions`.
   - The deposit is auto-calculated and editable.
   - The customer preview is shown live.
3. **Send** sets `sent` and queues SMS, email and Telegram with `/q/[token]`. There's a `Copy` button for pasting into WhatsApp.
4. The customer opens the link, taps **Accept & pay deposit**, goes to Chapa and comes back as `deposit_paid`. The event now appears on the calendar.
5. The balance goes out as a second link (`quote_balance`), or staff record it manually, which moves the quote to `paid`.
6. A revision creates a new quote and marks the old one `superseded`. The old link points to the new one.

**"Viewed" comes from a beacon, not from the page load.** Telegram, WhatsApp and Facebook fetch `/q/[token]` to build the link preview, and staff open it to check it. If `viewed` were set in `load`, every sent quote would turn `viewed` within seconds and alert staff for nothing. So:

- `load` never writes.
- After the page hydrates (a real browser running JS), it `POST`s once to `/q/[token]/viewed`. `quotes.view()` sets `viewedAt` and `viewed` only if the quote is `sent`, and alerts staff once.
- The beacon is skipped when the viewer is signed-in staff. Staff previews use the dashboard's preview, not the public link.
- The endpoint is rate limited and idempotent.

**Gift direct-buy:** ad → `/buy/[slug]` → `/checkout` with the item in the cart. The customer enters phone, name, and pickup or delivery, then pays with Chapa and lands on `/o/[token]` with a confirmation. That's three screens.

**Rental:** `/rent/book/[slug]` → dates (unavailable days disabled, live price) → contact → pay → `confirmed`. A reminder goes out before `endDate`, and staff mark `out` and `returned`.

**School:** "7 seats left" → register → pay → `confirmed`. In Phase 2, staff mark the result and the student is notified.

**Telegram:**

- The bot's menu button opens `/tg`.
- `initData` is verified server-side (HMAC with the bot token) and maps to `customer.telegramUserId`, so contact details pre-fill with no login.
- The bot runs in webhook mode, never long polling.

---

## 12. Components

### 12.1 Layering

```
@nahu/admin-kit                  primitives, forms, tables, detail pages, statuses, reports, print, files  ← FIRST
$lib/components/store/*          Amoria storefront pieces, composed of kit pieces
$lib/components/dashboard/*      Amoria dashboard pieces, composed of kit pieces
```

- There's no `shared/` folder of our own. If both sides need it, it belongs in the kit.
- Components take typed props (`$props()` with a `Props` type), expose variations through props and snippets, and don't fetch. Data comes from `load`.
- **Forms everywhere** (storefront included) use `createForm` + kit `formComponents`, posting to actions with superforms enhancement.
- All user-visible text goes through Paraglide (`m.key()`). Keep `en.json` and `am.json` in sync. **[Kit gap]** Where a kit component has hard-coded English labels, add a label prop to it in the kit.

### 12.2 App components (all built from kit pieces)

| Component                                    | Built from                                                                        | Used by                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `ContactFields`                              | `InputComp` ×3 (tel **[Kit gap]**, text, email)                                   | checkout, rental, quote request, registration      |
| `PaySummary`                                 | `formatETB`, `LoadingBtn`, shadcn `card`                                          | checkout, rental, `/q`, registration, status pages |
| `ProductCard`, `ProductGrid`                 | shadcn `card`, `badge`, `formatETB`, public image URL                             | shop, rent, home                                   |
| `ImageGallery`                               | shadcn `carousel` (add to kit if missing)                                         | product, package, portfolio                        |
| `AddToCart`, `CartSummary`                   | `button`, `input`, `formatETB`                                                    | shop                                               |
| `RentalDatePicker`                           | kit `DateRangePicker` + `isDateUnavailable` **[Kit gap]**                         | rental                                             |
| `SeatsLeft`                                  | `badge`                                                                           | school, home                                       |
| `PackageCard`, `PortfolioCard`               | `card`, `formatETB`                                                               | décor, home                                        |
| `ChatButtons`                                | `button` (WhatsApp + Telegram deep links with pre-filled text)                    | footer, product, package, status pages             |
| `SiteHeader`, `SiteFooter`, `LanguageSwitch` | `navigation-menu`, `sheet`, Paraglide                                             | public layout                                      |
| `StatusPage`                                 | `SingleView`, `SingleTable`, `statuses`, `PaySummary`                             | `/o`, `/r`, `/q`, `/reg`, account                  |
| `QuoteBuilder`                               | `SingleView`, `LineItemsEditor` **[Kit gap]**, `FormDialog`, `Copy`, `PrintSheet` | dashboard                                          |
| `TodayBoard`                                 | `StatCard`, `data-table`                                                          | dashboard                                          |
| `BookingCalendar`                            | shadcn `calendar` + kit Ethiopian helpers                                         | rentals and events                                 |
| `StockAdjustDialog`, `ManualPaymentDialog`   | `FormDialog`, `InputComp`, `FileUpload`                                           | dashboard                                          |

### 12.3 Ease-of-use rules

- Mobile first. Touch targets are at least 44 px. The primary action is visible without scrolling on a phone.
- Forms ask only for what's needed: phone and name, with email optional.
- Show the price and what happens next before paying ("You'll pay ETB 1,250.00 with Chapa, then get an SMS").
- Every status page says what's done and what's next, and shows `ChatButtons`.
- Dashboard tables default to the most useful filter (e.g. Orders defaults to "needs action").

---

## 13. SEO and performance targets

- SSR, clean URLs, `sitemap.xml`, canonical + `hreflang` (en/am), and JSON-LD: `LocalBusiness` (Mekanisa), `Product`, `Course`, `BreadcrumbList`.
- Target searches: "event decoration Addis Ababa", "wedding decoration Addis Ababa", "birthday decoration Addis Ababa", "decoration training Addis Ababa", "gift shop Mekanisa".
- Budgets on a mid-range phone over 3G: LCP under 2.5 s; storefront JS under ~100 KB gzip per route; images lazy-loaded except the hero; Ethiopic font self-hosted and subset.

---

## 14. Build order (to hit 24 Oct 2026)

**Launch cut [Decision].** There are about 25 days from 29 Sep. The client's content can arrive as late as about 13 Oct, and eight kit gaps each need a kit release. That is too much for the full list, so launch ships the flows that take money and the décor quote flow. Everything else follows in the weeks after launch. Nothing in the cut changes the schema design; it only changes the order.

**Week 1 (by ~6 Oct): foundation + all kit gaps together**

1. **Foundation:** §4.3 fixes; `schema/` layout + `connection.ts` (UTC + pool limits); roles and permissions with boot sync; `configureKit({ db, auditLog, loginPath })`; cache; settings; tokens; job runner (with `job_lock` seeding and the tick endpoint); outbox with email.
2. **Kit gaps in one batch, one release:** statuses map (with translated labels), public file handler, `serveFile` `canRead` guard, tel input + `normalizePhone`, `isDateUnavailable`, `LineItemsEditor`. Bilingual field pattern and multi-file upload only if cheap; single files are fine at launch.

**Weeks 2–3: launch scope** 3. **Catalog + media:** products, categories, image child tables, `stock.ts`, public shop pages, SEO basics. 4. **Payment pipeline + gift checkout:** Chapa, `Payable` (including late payments, §7), orders, cart cookie, `/buy/[slug]`, `/o/[token]`. 5. **Messaging:** SMS and Telegram staff alerts, en/am templates. 6. **Quotes:** request form, quote builder, `/q/[token]` with the view beacon, print. This is the core décor flow. 7. **Rentals.**

**Week 4 (by 24 Oct): hardening** 8. Rate limits, e2e for the launch flows, host dry run (cron tick, one Passenger instance, `max_user_connections`, SMTP limit), backups.

**At launch:** the storefront shows no sign-up or login link. Only staff sign in (turn sign-up off in better-auth), so no customer session can exist before `/account` is built.

**Right after launch (in this order):** 9. **School** (catalog pages can go live earlier as "contact us to register" if the content is ready). 10. **Customer accounts** (§4.2 linking rules), then turn sign-up on. 11. **Telegram mini app + bot webhook.** 12. **Attribution + campaign links.** Setting the `am_src` cookie and `sourceId` can be wired in at launch at little cost, so that early traffic is already attributed.

**Phase 2:** stock and rental screens, returns/overdue, graduation results, reports.

---

## 15. Content Amoria must supply (first two weeks)

- Chapa merchant account in Amoria's name
- Gifts and rental items: names (EN/AM), prices, stock counts, photos
- Décor packages (tiers, inclusions, starting prices, keywords) and portfolio photos
- Courses: curriculum, intake dates, fee, seat limits
- Domain; business email, phone, WhatsApp and Telegram handles; Mekanisa address and hours
- Logo (`~/Documents/amoria/longLogo.png`) and brand colours (applied through the kit theme's CSS variables)
- Staff list with Telegram accounts, and a staff alert group

---

## 16. Open decisions (build the default, keep it configurable)

| Decision                                                                    | Default until told otherwise                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment provider                                                            | Chapa (covers telebirr)                                                                                                                                                                                                 |
| Quote payment                                                               | `depositPercent` = 50%; balance via second link or manual                                                                                                                                                               |
| Rental deposit, minimum days, pickup/return times                           | `deposit` 0, `minRentalDays` 1                                                                                                                                                                                          |
| Gift delivery                                                               | On (`deliveryEnabled` true) with per-area fees; demo areas and fees in `scripts/seed-dev.sql` until Amoria supplies theirs. Free delivery from ETB 3,000 (`freeDeliveryThreshold`), nudge from ETB 2,000 — placeholders |
| SMS gateway                                                                 | Provider interface; AfroMessage or GeezSMS                                                                                                                                                                              |
| Customer phone OTP                                                          | Off at launch; per-record verified-email matching only (§4.2)                                                                                                                                                           |
| Launch scope                                                                | The cut in §14: accounts, school, Telegram mini app and campaign links follow right after launch                                                                                                                        |
| Rental security deposit refunds                                             | Not designed; keep `deposit` 0 until decided (§5.4)                                                                                                                                                                     |
| Late payment on an expired record                                           | Re-reserve if possible, else `paid_unfulfillable` + staff rebook/refund (§7)                                                                                                                                            |
| Migration method on host                                                    | Local `drizzle-kit migrate` against host DB                                                                                                                                                                             |
| Meta/TikTok pixels                                                          | Off; add behind a setting                                                                                                                                                                                               |
| Campaign extras (promo/creator codes, giveaway form, Refer & Earn vouchers) | Not in launch scope; `refCode` attribution only                                                                                                                                                                         |

---

## 17. Rules for agents (quick reference)

- ✅ **Admin-kit first, always.** Check its README table before writing anything. Fill gaps **in the kit** (§2), never with a local copy.
- ✅ Use `contentCrud`/`childCrud`/`LookupPage` for CRUD, `data-table` (server mode for growing lists) for lists, `SingleView`/`Section`/`FormDialog` for details, `createForm` + `InputComp` for every form, `statuses` for every status, `formatETB` for every amount, and kit date helpers for every date.
- ✅ Use the mixins (`secureFields`/`lesserFields`/`deletionFields`), `notDeleted()` on every read, `recordAudit` in the same transaction, and `WriteRefused` for rule violations.
- ✅ Every dashboard page gets an `access.ts` rule, a `navigation.ts` entry, and `requirePermission`/`requireSuperAdmin` on its actions.
- ✅ Money in birr `decimal(12,2)` computed only in services; text via Paraglide (en + am); Svelte MCP + `svelte-autofixer` on every `.svelte` file.
- ❌ No DB triggers, procedures, events, BLOBs, `serial()` or `cascade`. No native npm modules. No building on the server.
- ❌ Never trust client amounts, never skip payment verification, never send messages inline (use the outbox).
- ❌ Never require an account. Never expose numeric IDs, private files or another customer's data publicly.
- ❌ No unbounded caches, long polling, or `setInterval` as the only way something runs.
