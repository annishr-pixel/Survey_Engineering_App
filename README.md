# Treadlight Solar Survey Application

On-site solar survey capture for TreadLighter survey engineers. Pulls approved
leads from Notion, captures an exhaustive 8-section site survey with photos, and
stores strictly-typed data in Postgres so the sales team can build accurate
quotations. On submit, the Notion lead status is pushed to **Ready for Quotation**.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript (strict)
- **Drizzle ORM** + **Neon Postgres** (`@neondatabase/serverless`)
- **Auth.js v5** (Credentials + JWT sessions, Argon2id) — roles: `surveyor`, `sales`
- **Zod** validation (shared client + server)
- **Tailwind CSS** + custom UI primitives
- **Vercel Blob** for photos (direct browser uploads)
- **@notionhq/client** REST integration

## Prerequisites (one-time, in Notion)

1. Add a **"Ready for Quotation"** option to the **Status** select on the
   *Treadlight Website Enquiries* database (the write-back target).
2. Create an internal Notion integration and **share it with both databases**
   (*Treadlight Website Enquiries* and *Customer Details*).
3. Copy the integration token and the two database IDs into your env.

## Local setup

```bash
npm install
cp .env.example .env        # fill in real values
npm run db:generate         # generate the SQL migration from schema.ts
npm run db:migrate          # apply to Neon (uses DATABASE_URL_UNPOOLED)
npm run db:seed             # create demo surveyor + sales users
npm run dev
```

Default seeded logins (override via `SEED_*` env vars before seeding).
Usernames are case-insensitive:

| Role     | Username         | Password      |
| -------- | ---------------- | ------------- |
| surveyor | Elmechltd        | Elmechltd123  |
| sales    | Elmechltd-sales  | Elmechltd123  |

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`AUTH_SECRET`, `AUTH_URL`, `NOTION_TOKEN`, `NOTION_ENQUIRIES_DB_ID`,
`NOTION_CUSTOMER_DETAILS_DB_ID`, `BLOB_READ_WRITE_TOKEN`.
Optional: `NOTION_READY_STATUS_NAME` (defaults to "Ready for Quotation").

## How it works

- **Ingestion** — `POST /api/leads/refresh` (surveyor "Refresh leads" button)
  queries Enquiries where `Status = "Initial Estimation Generated"` **and**
  `Customer Approval = "Y"`, joins *Customer Details* on `Job ID`, and upserts
  the `leads` cache.
- **Survey** — `/jobs/[jobId]` opens (or creates) a draft. Fields autosave every
  ~1.5s. Photos upload directly to Vercel Blob per section. Three fields are
  mandatory before submit: **asbestos present**, **looped supply**,
  **main fuse rating**.
- **Submit** — the survey is committed to Postgres first, then the Notion status
  is pushed best-effort. If Notion fails, `notion_pushed` stays false and the
  confirmation page offers a retry — the survey is never lost.
- **Sales** — `/sales` (sales role) is a filterable read-only table over the
  typed survey columns (fuse rating, asbestos, cable lengths, scaffold, …).

## Data model

One wide, typed `surveys` table holds everything sales filters on (enums,
booleans, integers); narrative free-text lives in a `surveys.extras` JSONB
column. `leads` caches joined Notion data; `photos` is one row per image.
Field definitions live in `lib/survey-sections.ts`; validation in
`lib/validation/survey.ts`; schema in `lib/db/schema.ts`.

## Deployment (Vercel)

1. Import the repo; set all env vars (Production/Preview/Development scopes).
2. Provision Vercel Blob in the project.
3. Apply migrations on deploy (`npm run db:migrate` against `DATABASE_URL_UNPOOLED`).
4. Use Neon DB branching for preview deployments so they don't touch prod data.

## Deferred (phase 2)

Offline/PWA sync, background cron lead refresh, and the full sales quotation
dashboard. The current `/sales` table proves the typed data is queryable.
