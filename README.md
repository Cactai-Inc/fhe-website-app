# French Heritage Equestrian — website & app

A single React + TypeScript application serving three audiences from one codebase:

- **Public website** — marketing pages, the service catalog, booking funnels, gift
  certificates, and the inquiry/intake flow.
- **Client app** (`/app/**`) — the authenticated member experience: dashboard,
  calendar & booking, orders, documents & contracts, horses/stable, evaluations, and
  community.
- **Staff / ops** (`/app/ops/**`) — intake and leads, contacts and team, horse records,
  the document queue, payments, contract authoring, activity, and admin settings.

**Stack:** React · TypeScript · Vite · Tailwind · Supabase (Postgres + RLS + RPCs) ·
Vercel serverless (`api/`) · Google Workspace SMTP for transactional email.

---

## Getting started

```bash
npm install
npm run dev          # vite dev server

npm run typecheck    # frontend types
npm run typecheck:api# serverless types
npm run lint
npm run build        # vite build + prerender + seo files
```

Database access for scripts/queries uses the connection string on the first line of
`.env.db` (gitignored).

---

## Documentation — where to look

| Start here | What it is |
|---|---|
| **`/CLAUDE.md`** | Orientation: the live data spine, what's **retired** (don't resurrect it), the migration convention, and the settled owner decisions |
| **`docs/HANDOFF.md`** | Where the system stands and what's worth doing next |
| **`docs/BACKLOG.md`** | Standing work list: ready, known defects, deferred |

Other references: `docs/NOTIFICATIONS.md` (email nudge cron),
`docs/GOOGLE_SMTP_SETUP.md` (transactional email wiring),
`docs/TOKEN_DICTIONARY.md` (merge tokens),
`docs/DUAL_IDENTITY_TRACE.md` (how act-as-company works),
`supabase/contract_templates/HORSE_LEASE.md` (**how to edit the lease** — its content
lives in the database, not in a markdown template).

---

## A few things worth knowing up front

- **The catalog has no tiers.** Every offering is its own SKU; its mechanics are data
  (`config_kind`, `unit_count`, `weekly_frequency`), read via the `public_offerings`
  RPC. There is no hardcoded catalog — if you find one, it's a bug.
- **Identity has two anchors:** `contacts` (a person record, may have no login) and
  `profiles`↔`auth.users` (an account). `profiles` is the 1:1 bridge.
- **Affiliation groups are derived, never hand-written** — `derive_affiliations()`
  computes them from signed documents + horse ownership, and `apply_affiliations()` is
  the only writer.
- **Migrations are a hand-maintained journal** applied via `psql`, not the Supabase CLI.
  Dry-run in a rolled-back transaction, apply, verify, commit.
