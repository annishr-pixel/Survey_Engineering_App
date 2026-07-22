# Treadlight Solar Survey Application — Operations & Reference Guide

> **Purpose of this document**
> A single, day-to-day operational reference for the Treadlight Solar Survey App: what it is,
> how data flows through it, how the pieces connect, how to start/stop it, and — most importantly —
> **where to look when something goes wrong**. Written to be read by an engineer, an ops person, or
> a support handler, not just the original developer.

**Last generated:** 2026-07-22
**App name / version:** `treadlight-survey-app` v0.1.0 (MVP)
**Owner:** Elmech Ltd / TreadLighter

---

## 1. What this application does (in one paragraph)

Field survey engineers use this web app to run on-site solar surveys. The app pulls **customer-approved
leads from Notion**, presents an exhaustive **8-section site survey** (with photo capture per section),
and saves the answers as **strictly-typed data in a Postgres database**. When a surveyor submits, the app
writes the survey to Postgres first, then **pushes the status back to Notion** ("Ready for Quotation") and
**emails the sales team**. Sales staff use the same app (different role) to approve/reject customers,
review completed surveys in a filterable table, and generate **Final Quotation PDFs**.

There are only **two kinds of users**: `surveyor` and `sales`. There is no public sign-up — accounts are seeded.

---

## 2. The big picture — how data flows

```
                        ┌──────────────────────────────────────────────────────────────┐
                        │                          NOTION                                │
                        │   ┌───────────────────────┐   ┌───────────────────────────┐   │
                        │   │ Treadlight Website     │   │ Customer Details          │   │
                        │   │ Enquiries (DB)         │   │ (DB)                      │   │
                        │   │  • Status (select)     │   │  • Status (text)          │   │
                        │   │  • Customer Approval   │   │  • Address, kWh, Y/N ...   │   │
                        │   │  • Initial Est. Amount │   │  • Plans / Drawings       │   │
                        │   └──────────┬────────────┘   └────────────┬──────────────┘   │
                        └──────────────│─────────────────────────────│──────────────────┘
             (1) READ IN               │  joined on "Job ID"         │        ▲
             pull approved leads       ▼                             ▼        │ (4) WRITE BACK
                        ┌──────────────────────────────────────────────────────────────┐
                        │                THE APP  (Next.js 15, Vercel/Node)              │
                        │                                                                │
                        │   /api/leads/refresh ──► syncLeads() ──► upsert `leads` cache  │
                        │                                                                │
                        │   /jobs/[jobId]  ──► SurveyForm (autosave) ──► `surveys` table │
                        │        └─ photos ──► /api/photos/upload ──► `photos` table     │
                        │                                                                │
                        │   submit ──► commit survey ──► push Notion ──► email sales     │
                        │                                                                │
                        │   /sales/* ──► read `surveys`+`leads`, approve, build PDFs     │
                        └───────────┬──────────────────────────────┬───────────────────┘
                                    │ (2) PROCESS & STORE           │ (3) FLOW OUT
                                    ▼                               ▼
                        ┌────────────────────────┐    ┌────────────────────────────────┐
                        │   POSTGRES (Neon)      │    │  Vercel Blob  → survey photos   │
                        │   users / leads /      │    │  SMTP         → sales email      │
                        │   surveys / photos     │    │  PDF (pdf-lib)→ quotation docs  │
                        └────────────────────────┘    └────────────────────────────────┘
```

### The lifecycle, step by step

| # | Stage | Trigger | What happens | Where the data lands |
|---|-------|---------|--------------|----------------------|
| 1 | **Initial approval** | Sales opens **Survey Approvals** | App queries Notion *Enquiries* where `Status = "Initial Estimation Generated"`. Sales clicks Approve (Y) / Reject (N). | Notion `Customer Approval`, mirrored into `leads` |
| 2 | **Ingestion** | Surveyor clicks **Refresh leads** (or after an approval) | `syncLeads()` reads Enquiries where `Status = "Initial Estimation Generated"` **AND** `Customer Approval = "Y"`, joins *Customer Details* on `Job ID`, upserts the cache. | `leads` table |
| 3 | **Survey capture** | Surveyor opens `/jobs/[jobId]` | A draft survey row is auto-created. Every field change autosaves (~1.5 s debounce). Photos upload per section. | `surveys` (draft), `photos` |
| 4 | **Submit** | Surveyor clicks **Submit survey** | Zod validates 3 mandatory fields → row set to `submitted` → **best-effort** Notion write-back ("Ready for Quotation") → **best-effort** sales email. | `surveys.status = submitted`, Notion status, email |
| 5 | **Sales review** | Sales opens `/sales` | Filterable read-only table over typed survey columns. | reads `surveys` + `leads` |
| 6 | **Final quotation** | Sales opens **Final Quotation** | Lists *Customer Details* at "Ready for Quotation". Sales approves/rejects and downloads a generated **Final Quotation PDF**. | Notion write-back + on-the-fly PDF |

**Key design principle:** *the survey is never lost to an outage.* Postgres is committed **first**; Notion
write-back and email are **best-effort** and independently retryable. If Notion fails, `surveys.notion_pushed`
stays `false` and the confirmation page offers a **Retry** button.

---

## 3. Software used & versions

### Runtime / platform
| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 18+ (Node runtime required) | All API routes/actions run on `runtime = "nodejs"` (Argon2 + Notion SDK need native crypto) |
| Next.js | ^15.1.6 (App Router) | React Server Components, server actions |
| React / React DOM | ^19.0.0 | |
| TypeScript | ^5.7.3 | `strict: true` |

### Core dependencies
| Library | Version | Role |
|---------|---------|------|
| `drizzle-orm` | ^0.38.3 | Database ORM (typed queries) |
| `drizzle-kit` | ^0.30.2 | Migrations / schema push |
| `pg` | ^8.22.0 | Postgres driver (node-postgres pool) |
| `@neondatabase/serverless` | ^0.10.4 | Neon serverless driver (prod option) |
| `next-auth` | 5.0.0-beta.25 (Auth.js v5) | Authentication, JWT sessions |
| `@node-rs/argon2` | ^2.0.2 | Argon2id password hashing |
| `zod` | ^3.24.1 | Shared client + server validation |
| `@notionhq/client` | ^2.2.16 | Notion REST integration |
| `@vercel/blob` | ^0.27.3 | Photo + estimation-PDF storage (prod) |
| `nodemailer` | ^6.10.1 | Sales notification email (SMTP) |
| `pdf-lib` | ^1.17.1 | Final quotation PDF generation |
| `react-hook-form` + `@hookform/resolvers` | ^7.54.2 / ^3.10.0 | Form state + Zod resolver |
| `tailwindcss` | ^3.4.17 | Styling |
| `@paper-design/shaders-react` | ^0.0.76 | Animated background |
| `lucide-react` | ^0.469.0 | Icons |

### External services
| Service | Used for | Auth |
|---------|----------|------|
| **Neon Postgres** | Primary datastore | `DATABASE_URL` (pooled) / `DATABASE_URL_UNPOOLED` (migrations) |
| **Notion** | Source of leads + status write-back | `NOTION_TOKEN` (internal integration) |
| **Vercel Blob** | Survey photos (prod) + initial-estimation PDFs | `BLOB_READ_WRITE_TOKEN` |
| **SMTP server** | "Survey submitted" email to sales | `SMTP_*` vars |

---

## 4. Database — tables, columns & connections

**Engine:** PostgreSQL (Neon in prod; local Postgres 13 on **port 5433** in dev — note the non-default port).
**Schema source of truth:** `lib/db/schema.ts` (Drizzle). Migrations live in `drizzle/`.
**Naming:** columns are `snake_case` in the DB, `camelCase` in code (Drizzle `casing: "snake_case"`).

### 4.1 Table: `users`
Who can log in. No self-signup — seeded via `npm run db:seed`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | auto |
| `email` | text, **unique** | login identifier (stored lowercased) |
| `password_hash` | text | Argon2id hash |
| `name` | text | display name |
| `role` | enum(`surveyor`,`sales`) | drives routing & permissions |
| `created_at` | timestamptz | |

### 4.2 Table: `leads`  *(local cache of joined Notion data)*
One row per **Job ID**. Populated by `syncLeads()`. This is a **cache** — Notion is the source of truth.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `job_id` | text, **unique** | join key across both Notion DBs |
| `enquiry_page_id` | text | Notion *Enquiries* page id — needed for status write-back |
| `customer_details_page_id` | text (nullable) | Notion *Customer Details* page id |
| `customer_name`, `email`, `phone`, `address`, `postcode` | text | customer info |
| `property_use` | enum(`domestic`,`commercial`) | |
| `service_interested` | text[] | multi-select from Notion |
| `initial_estimated_amount` | numeric(10,2) | |
| `annual_consumption_kwh`, `current_electricity_price` | text | |
| `pv_installed`, `fit_arrangement`, `conservation_area` | boolean | parsed from Y/N text |
| `council_details` | text | |
| `notion_status` | text | last-seen Notion status |
| `customer_approval` | text | `"Y"` / `"N"` / null (gates surveyor visibility) |
| `reason_for_rejection` | text | captured on rejection |
| `synced_at` | timestamptz | last sync time |

### 4.3 Table: `surveys`  *(the core record — one per job)*
Wide, **strictly-typed** table so sales can filter on any field. Free-text notes go into the `extras` JSONB column.

- **`id`** uuid PK · **`lead_id`** → `leads.id` · **`job_id`** text **unique** (one survey per job) · **`surveyor_id`** → `users.id`
- **`status`** enum(`draft`,`submitted`), default `draft`
- **3.2 Site access:** `scaffold_front/rear/gable`, `scaffold_permit_required` (bool)
- **3.3 Roof/structure:** `roof_type` (enum), `roof_pitch_deg`, `roof_azimuth_deg`, `rafter_thickness_mm`, `rafter_spacing_mm`, `rot_present`, `multiple_roof_faces`, `roof_face_count`, `mount_type` (enum)
- **3.4 Technical/hardware:** `viable_system_kw`, `panel_wattage_w`, `panel_quantity`, `inverter_quantity`, `battery_capacity_kwh`, `pas63100_compliant`, `dc_cable_length_m`, `ac_cable_length_m`, `consumer_unit_spare_ways`, **`main_fuse_rating`** (enum, *mandatory at submit*), **`looped_supply`** (*mandatory*), `smets2_present`, `wifi_strength`
- **3.5 Labour:** `labour_man_days`, `groundworks_trenching`, `remedial_works`
- **3.6 Compliance:** `dno_connection` (G98/G99), `export_limitation`, `planning_permission_required`, `listed_building`, `article_4`, `building_regs_parts` (text[]), `mcs_applicable`
- **3.7 Financial:** `estimated_yield_kwh`, `cu_upgrade_required`, `tree_trimming_required`, `dno_fees_expected`, `planning_fees_expected`
- **3.8 Risk:** **`asbestos_present`** (*mandatory*), `showstopper_present`, `ev_future`, `heatpump_future`, `eps_backup`
- **`extras`** jsonb — 28 narrative note fields (parking, shading, inverter type, RAMS notes, red-flag notes, etc.)
- **`notion_pushed`** boolean — `false` if the Notion write-back failed (drives the retry UI)
- **`created_at` / `updated_at` / `submitted_at`** timestamptz

> **Mandatory-to-submit fields (enforced by Zod `submitSchema`):** `asbestos_present`, `looped_supply`, `main_fuse_rating`. A draft can be saved without them; submit cannot.

### 4.4 Table: `photos`  *(one row per image)*
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `survey_id` | uuid → `surveys.id` **ON DELETE CASCADE** | delete survey → photos go too |
| `section` | text | e.g. `"3.3"` |
| `blob_url` | text | public URL (Vercel Blob) or `/uploads/...` (local dev) |
| `blob_pathname` | text | relative storage path (used for deletion) |
| `caption`, `content_type`, `size_bytes` | | |
| `uploaded_at` | timestamptz | |

### 4.5 Relationships
```
users (1) ───< surveys (surveyor_id)
leads (1) ───< surveys (lead_id, and job_id join)
surveys (1) ───< photos (survey_id, CASCADE)
```

### 4.6 Connection details
- **App runtime** connects via `DATABASE_URL` (pooled). Pool is created once and reused across hot reloads (`lib/db/client.ts`).
- **Migrations & seed** use `DATABASE_URL_UNPOOLED` (direct/unpooled) — see `drizzle.config.ts`, `scripts/seed.ts`.
- **TLS:** automatically **disabled** for `localhost`, **enabled** (`rejectUnauthorized: false`) for hosted DBs.
- Local dev Postgres runs on **port 5433** (not the default 5432).

---

## 5. External integrations — how they connect

### 5.1 Notion (source of truth for leads)
- Two databases: **Treadlight Website Enquiries** (`NOTION_ENQUIRIES_DB_ID`) and **Customer Details** (`NOTION_CUSTOMER_DETAILS_DB_ID`), joined on the **Job ID** property.
- Authentication: an **internal integration token** (`NOTION_TOKEN`) that **must be shared with BOTH databases** or reads/writes 404.
- **Multi-data-source quirk:** the Enquiries DB has a stray extra "New data source". The app uses a **second client pinned to Notion API `2025-09-03`** (`notionDataSources` in `lib/notion/client.ts`) to resolve the real data source and query it directly. The default client stays on `2022-06-28` for page updates.
- **Corporate TLS proxy:** requests to `api.notion.com` use a custom HTTPS agent that trusts both Node's bundled CAs **and the OS system trust store** — needed because the office network intercepts TLS. (See memory: `NODE_OPTIONS=--use-system-ca`.)
- **Write-backs performed:**
  - On submit → Enquiries `Status = "Ready for Quotation"` (select) + Customer Details `Status` (text).
  - Initial approval → Enquiries `Customer Approval = Y/N` (+ reason, + `Status = Rejected` on reject).
  - Final quotation → Customer Details + Enquiries `Status` and `Customer Approval`.

### 5.2 Vercel Blob (photos + estimation PDFs)
- Photos: in **production** uploaded to Vercel Blob; in **local dev** the `/api/photos/upload` route writes to `public/uploads/...` instead and returns the same `{ url, pathname }` shape.
- Initial-estimation PDFs are uploaded to Blob by the helper `upload-estimations.mjs` and served by `/api/estimation/[jobId]` (matched by `<jobId>_` filename prefix).
- Limits: allowed types `jpeg/png/webp/heic`, max **15 MB** per file.

### 5.3 SMTP email (optional)
- Sends a "Survey submitted — ready for quotation" email to `SALES_NOTIFICATION_EMAIL` on submit.
- **Fully optional & non-blocking:** if `SMTP_HOST` or the recipient is unset, the step is skipped silently and the submission still succeeds.

### 5.4 Final-quotation PDF (pdf-lib)
- Generated on demand by `/api/final-quotation/[jobId]` — pulls Customer Details from Notion + the survey from Postgres, renders an A4 PDF. Non-Latin characters are sanitised so rendering never throws.

---

## 6. Screens & who sees them

Access is role-gated in `lib/auth.config.ts` + `middleware.ts`. Surveyors are redirected to `/jobs`; sales to `/sales`.

| Route | Role | Purpose |
|-------|------|---------|
| `/login` | public | Username (case-insensitive) + password |
| `/jobs` | surveyor | Approved leads list (only `Customer Approval = Y`). **Refresh leads** button triggers ingestion. |
| `/jobs/[jobId]` | surveyor | The 8-section survey form. Autosaves; **Submit** when ready. |
| `/jobs/[jobId]/submitted` | surveyor | Confirmation; Notion **retry** if write-back failed. |
| `/sales/survey-approvals` | sales | Approve/reject customers (initial estimate stage). View initial-estimation PDF. |
| `/sales` | sales | **Completed surveys** — filterable read-only table (fuse, roof type, asbestos…). |
| `/sales/[jobId]` | sales | Full read-only survey detail. |
| `/sales/[jobId]/edit` | sales | Sales can edit a survey. |
| `/sales/final-quotation` | sales | Approve/reject final quotation; download Final Quotation PDF (gated on a submitted survey). |
| `/sales/reports` | sales | Reporting view. |

---

## 7. Environment variables

Set in `.env` (local) / Vercel project settings (prod). Templates: `.env.example`, `.env.local`, `.env.production.local`.

**Required (app will throw at first use if missing):**
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Pooled Postgres connection (runtime) |
| `DATABASE_URL_UNPOOLED` | Direct connection (migrations/seed) |
| `AUTH_SECRET` | JWT signing secret (`npx auth secret`) |
| `AUTH_URL` / `APP_URL` | Public base URL (used for redirects + email links) |
| `NOTION_TOKEN` | Notion integration secret (shared with both DBs) |
| `NOTION_ENQUIRIES_DB_ID` | Enquiries database id |
| `NOTION_CUSTOMER_DETAILS_DB_ID` | Customer Details database id |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access |

**Optional:**
| Var | Default | Purpose |
|-----|---------|---------|
| `NOTION_READY_STATUS_NAME` | `Ready for Quotation` | Status pushed on submit (must exist on Enquiries) |
| `SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASS` | — / 587 / false | Email transport (blank = disabled) |
| `MAIL_FROM`, `SALES_NOTIFICATION_EMAIL` | — | Email sender / recipient(s) (comma-separated) |
| `INITIAL_ESTIMATION_FILE_PATH` | — | Local folder of initial-estimation PDFs |
| `SEED_SURVEYOR_*`, `SEED_SALES_*` | see below | Override seeded credentials |

> **Windows/TLS note (from project memory):** on this machine Node needs `NODE_OPTIONS=--use-system-ca`
> so outbound TLS (Notion) trusts the corporate proxy's root CA.

**Default seeded logins** (override with `SEED_*` before seeding; usernames are case-insensitive):

| Role | Username | Password |
|------|----------|----------|
| surveyor | `Elmechltd` | `Elmechltd123` |
| sales | `Elmechltd-sales` | `Elmechltd123` |

---

## 8. How to start & stop

### 8.1 Local development
```powershell
# First-time setup
npm install
copy .env.example .env        # then fill in real values
npm run db:generate           # generate SQL migration from schema.ts
npm run db:migrate            # apply migrations (uses DATABASE_URL_UNPOOLED)
npm run db:seed               # create the two demo users

# Start the dev server (hot reload) — http://localhost:3000
npm run dev
```
**Stop:** press `Ctrl + C` in the terminal running `npm run dev`.

> If Notion calls fail locally with certificate errors, start with:
> `$env:NODE_OPTIONS="--use-system-ca"; npm run dev`

### 8.2 Production (Vercel — recommended)
- Push to the connected git repo → Vercel builds (`npm run build`) and deploys automatically.
- Set **all** env vars in the Vercel project (Production/Preview/Development scopes).
- Provision **Vercel Blob** in the project.
- Apply DB migrations on deploy: `npm run db:migrate` against `DATABASE_URL_UNPOOLED`.
- Use **Neon branching** for preview deployments so they never touch prod data.
- **"Stopping" prod** = disable the deployment / pause the project in Vercel; there is no long-running server to kill.

### 8.3 Production (self-hosted Node)
```powershell
npm run build       # compile
npm run start       # serve the built app (default port 3000)
```
Run behind a process manager (pm2 / Windows service / systemd). **Stop** = stop that process.

### 8.4 Useful commands
| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` — the CI quality gate (no ESLint in MVP) |
| `npm run db:generate` | Generate a migration from `schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev only — skips migration files) |
| `npm run db:seed` | Create/update the seeded users |

---

## 9. Troubleshooting — what to check & where

### 9.1 Where the logs live
| Log | Location | Contains |
|-----|----------|----------|
| **App event log** | `logs/app-YYYY-MM-DD.log` (project root) | Structured, multi-line entries written by `lib/logger.ts` — especially approval & final-quotation steps (`final_quotation.approve.*`, `initial_approval.*`). Each entry = header line + pretty JSON. |
| **Server console** | terminal running `dev`/`start`, or **Vercel → Deployments → Logs** | `console.warn`/`console.error` (e.g. `[email] …` skipped/failed) + unhandled errors |
| **Browser console / Network tab** | user's browser (F12) | Client-side form/upload errors, failed API responses |

> The file logger **never throws** — if disk logging fails it silently continues, so also rely on the server console.

### 9.2 Symptom → check → fix

| Symptom | Where to check | Likely cause & fix |
|---------|----------------|--------------------|
| **Surveyor sees no jobs** after Refresh | `/sales/survey-approvals`; `leads` table `customer_approval` | Only leads with `Customer Approval = "Y"` show. Approve the customer in Survey Approvals, then Refresh. |
| **Refresh leads fails / 500** | Server console; Notion token & sharing | `NOTION_TOKEN` invalid or integration not shared with **both** DBs; TLS proxy (set `NODE_OPTIONS=--use-system-ca`). |
| **"unable to verify the first certificate"** | Server console | Corporate TLS proxy. Start Node with `--use-system-ca`; the Notion client already trusts the system store. |
| **Notion status didn't update after submit** | Confirmation page; `surveys.notion_pushed = false`; `logs/` | Best-effort write-back failed. Survey is safe in Postgres. Click **Retry** on the confirmation page (`retryNotionPush`). |
| **Submit blocked / validation error** | The form's field errors | The 3 mandatory fields (`asbestos_present`, `looped_supply`, `main_fuse_rating`) are required to submit. |
| **Photo upload fails** | Browser Network tab; `/api/photos/upload` | Type not in jpeg/png/webp/heic, or > 15 MB. Prod also needs `BLOB_READ_WRITE_TOKEN`. |
| **No sales email received** | Server console for `[email] … skipping` | `SMTP_HOST` or `SALES_NOTIFICATION_EMAIL` unset, or SMTP creds wrong. Email is optional — submission still succeeds. |
| **Final Quotation PDF 404** | `logs/` `final_quotation.pdf.not_found` | No Customer Details row in Notion for that Job ID, or Job ID mismatch. |
| **Initial estimation PDF 404** | `/api/estimation/[jobId]` | PDF not uploaded to Blob, or filename doesn't start with `<jobId>_`. Re-run `upload-estimations.mjs`. |
| **Can't log in** | `users` table; seed | Run `npm run db:seed`. Usernames are lowercased on login — case doesn't matter, password does. |
| **App crashes on boot: "Missing required environment variable"** | Startup error | A required env var (section 7) is unset. `lib/env.ts` fails fast on first access. |
| **DB connection refused (local)** | Postgres service | Local Postgres must be on **port 5433**; confirm `DATABASE_URL` port matches. |
| **Migration errors** | `drizzle/` + `DATABASE_URL_UNPOOLED` | Migrations use the **unpooled** URL. Ensure it's set and reachable. |

### 9.3 Quick health checks
- **Is the DB reachable?** run `npm run db:migrate` (a no-op run confirms connectivity) or query `users`.
- **Is Notion wired up?** open `/sales/survey-approvals` — it queries Notion live and shows a red error banner if it can't load.
- **Is auth working?** hit any protected route while logged out → should redirect to `/login`.
- **Are writes landing?** open a job, change a field, watch the "Saved · HH:MM" indicator flip to saved; confirm `surveys.updated_at` moved.

---

## 10. Day-to-day operational playbook

**Onboarding a new user**
Set `SEED_*` env vars (or edit `scripts/seed.ts`) → `npm run db:seed`. There is no in-app user management.

**A customer was approved but the surveyor still can't see the job**
The surveyor's list reads the `leads` cache. Either they press **Refresh leads**, or an approval already triggered a background `syncLeads()`. If still missing, check the lead exists in Notion with `Status = "Initial Estimation Generated"` **and** `Customer Approval = "Y"`.

**A survey needs editing after submission**
On the survey page, **Edit survey** (`reopenSurvey`) flips status back to `draft`, making fields/photos editable again. Re-submitting re-pushes Notion.

**Notion is down during a busy day**
Surveyors can keep working — surveys commit to Postgres regardless. `notion_pushed` stays `false` on affected jobs; use the **Retry** button (or `retryNotionPush`) once Notion recovers. Approvals that write to Notion will error and show a message; retry after recovery.

**Backups / data of record**
Postgres (`surveys`, `photos`) is the record of survey data. Notion holds lead/customer data and the workflow status. Back up the Neon database regularly; photos in Vercel Blob are addressed by the URLs stored in `photos.blob_url`.

**Rotating secrets**
Update the var in Vercel (or `.env`) and redeploy/restart. `AUTH_SECRET` rotation invalidates existing sessions (users must log in again).

---

## 11. Quick reference card

```
START (dev):     npm run dev            → http://localhost:3000
STOP (dev):      Ctrl + C
BUILD/RUN (prod):npm run build && npm run start
SEED USERS:      npm run db:seed
MIGRATE DB:      npm run db:migrate     (uses DATABASE_URL_UNPOOLED)
TYPECHECK:       npm run typecheck

LOGS:            logs/app-YYYY-MM-DD.log   (+ Vercel/terminal console)
DB:              Postgres (Neon prod / localhost:5433 dev)
TABLES:          users · leads · surveys · photos
MANDATORY@SUBMIT: asbestos_present · looped_supply · main_fuse_rating
NOTION-FAILED FLAG: surveys.notion_pushed = false → use Retry
ROLES:           surveyor → /jobs   |   sales → /sales
TLS FIX:         NODE_OPTIONS=--use-system-ca
```

---

*Generated from source: `lib/db/schema.ts`, `lib/notion/*`, `actions/*`, `app/**`, `lib/env.ts`,
`drizzle.config.ts`, `package.json`, `README.md`. Keep this file updated when the schema, integrations,
or env vars change.*
