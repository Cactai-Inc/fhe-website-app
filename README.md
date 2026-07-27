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
| **`/CLAUDE.md`** | Orientation: the live data spine, what's **retired** (don't resurrect it), the migration convention, and a trust ranking for every doc |
| **`docs/HANDOFF.md`** | Current state + suggested next moves — read this to pick up the work |
| **`docs/BACKLOG.md`** | Standing work list: blocked, ready, and known defects with file:line |
| **`docs/STATUS_REPORT.md`** | Point-in-time record of what shipped and what's verified |
| **`docs/ECOSYSTEM_PLAN.md`** | The in-flight identity/taxonomy refactor (Stages 0–2 done) |

Other current references: `docs/NOTIFICATIONS.md` (email nudge cron),
`docs/GOOGLE_SMTP_SETUP.md` (transactional email wiring),
`docs/TOKEN_DICTIONARY.md` (merge tokens),
`supabase/contract_templates/HORSE_LEASE.md` (**how to edit the lease** — its content
lives in the database, not in a markdown template).

> ⚠️ **`docs/archive/` is historical only.** Those docs describe earlier states of the
> platform and will actively mislead you — the tier layer was removed, `memberships`
> became `members`, engagements/orders were retired, and the catalog is now DB-driven.

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
