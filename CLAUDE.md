# CLAUDE.md — orientation for a working session

**Read this before trusting any other doc in this repo.** Several older docs describe
an application that no longer exists (see "Doc trust ranking" at the bottom).

---

## Commands

```bash
npm run typecheck        # tsc --noEmit -p tsconfig.app.json   (frontend)
npm run typecheck:api    # tsc --noEmit -p tsconfig.api.json   (api/ serverless)
npm run lint             # eslint .
npm run build            # vite build + prerender + seo-files
npm run dev              # vite
```
Baseline health: typecheck 0 errors, lint 0 errors (~26 pre-existing warnings).

---

## The live spine (what actually exists)

**Orders/commerce:** `purchases` + `purchase_items` + `bookings` + `lesson_credits`.
Purchases auto-get an order number (`display_code`, format `PUR-000001`, via the
`purchases_assign_code` trigger); `purchase_items` holds the contents plus a
`config jsonb` for per-line intent.

**Catalog:** flat SKUs in `offerings`, read via the `public_offerings` RPC.
**There is no tier layer** — it was removed 2026-07-08. Each offering IS the
purchasable item, and its mechanics are DATA: `config_kind`
(`scheduled` | `recurring` | `intake_finder` | `intake_evaluation` |
`document_transaction` | `inquire`), `unit_count`, `weekly_frequency`. All 43 SKUs
are classified. Frontend read path: `src/lib/publicCatalog.ts` + `src/lib/pricing.ts`.

**Identity — two anchors, one person in one at a time:**
- `contacts` = the person record (may have no login). ~34 tables key on `contact_id`.
- `profiles` (↔ `auth.users`) = the account. ~20 tables key on `user_id`.
- `profiles` is the 1:1 bridge. Owning a horse or being a contract party requires an
  account.
- `members` (renamed from `memberships` on 2026-07-26) = the access gate;
  `is_active_member()` reads it, and RLS on ~10 community tables depends on that.
  `members.tier` is vestigial (always `'community'`) and slated for removal —
  the word "membership" is deliberately reserved for a future real product.

**Affiliation groups are DERIVED, never hand-written.** `derive_affiliations(contact)`
computes them from executed documents + horse ownership; `apply_affiliations(contact)`
is the **sole writer** of RIDER / HORSE_OWNER / PARENT_GUARDIAN rows, kept live by
triggers on document-execution and horse-ownership. If you find code writing those
roles directly, that's a regression — route it through `apply_affiliations`.

**Other live subsystems:** `status_events` + `status_events_vocab` (+ `current_status`
denormalized on documents/purchases/bookings/invitations, maintained by triggers);
`evaluation_reports` (+ `_shares`, `_access`); invitation lifecycle
(`record_invitation_failure`, `supersede_invitations`, `invitation_expiry_days`);
`_ensure_client_account` (the shared account-creation spine).

---

## RETIRED — do not resurrect

Tables/concepts: `engagements`, `orders`, `client_purchases`, `lesson_sessions`,
`transactions`, offering **tiers**.
Functions: `start_broker_contract` (dropped 2026-07-26).
Files: `src/lib/services.ts`, `src/lib/catalog.ts` (both **deleted** — the two
hardcoded shadow catalogs; the catalog is DB-driven now).

**The lease is built from DB clause content**, not a flat markdown template
(`contract_section_defs` / `contract_clause_defs` / `contract_field_defs`, template
key `HORSE_LEASE_V2`, started by `start_lease_contract_v2`).
→ `supabase/contract_templates/HORSE_LEASE.md` is **CURRENT and useful**: it was
rewritten into a pointer doc explaining *where and how to edit the lease* (which
tables, a worked `UPDATE` example, the `PGCLIENTENCODING=UTF8` caveat, and how
`remerge_contract_from_clauses` recomposes). Read it before touching lease wording.
The owner round-trip export lives in `docs/contract-exports/`.

---

## Migration convention

Timestamped files in `supabase/migrations/`, additive. **There is no
`supabase_migrations.schema_migrations` table** — migrations are a hand-maintained
journal applied directly via `psql`. The DB connection string is the first line of
`.env.db` (gitignored).

Discipline used throughout this codebase:
1. Dry-run inside `BEGIN; … ROLLBACK;` against prod,
2. apply,
3. verify with a query,
4. commit.

Caveat: ~31 migrations rewrite existing function bodies in place (read
`pg_get_functiondef`, string-replace, re-execute). They are **not safe to replay on a
fresh database** — they would find nothing to rewrite and silently no-op. This is a
pre-existing property of the repo, not a per-migration bug.

---

## Working rule

Verify against the live database/code **before** asserting. This codebase has
repeatedly contradicted plausible-sounding assumptions (a column that looked
load-bearing was vestigial; "empty" tables turned out to be wired and code-referenced;
same-name contact records turned out to be different people). Query first.

---

## Doc trust ranking

**Current — trust these:**
- `docs/STATUS_REPORT.md` — point-in-time state, verified facts with row counts
- `docs/ECOSYSTEM_PLAN.md` — the identity/taxonomy plan (Stages 0–2 are DONE and live;
  3–6 pending)
- `docs/NOTIFICATIONS.md`, `docs/GOOGLE_SMTP_SETUP.md` — narrow and accurate
- `docs/contract-exports/` — generated from the live lease template

**Historical — do NOT follow as instructions:**
- `docs/README.md` — references deleted `src/lib/services.ts` and "service tiers";
  its schema section lists 2 tables for a DB with hundreds of migrations
- `docs/SETUP.md` — its member-grant SQL (`insert into memberships …`) **will fail**
  (table is `members`); says "run these 5 migrations" (there are 466); names Resend
  (the decision was Google Workspace SMTP)
- `docs/PLATFORM_ARCHITECTURE.md` — good seam/RLS discipline, but its "prime directive:
  nothing rewrites existing schema" is no longer true, and it models `engagements` /
  `products` / `product_prices` which are retired or never shipped
- `docs/COMPLETE-ENUMERATION.md` + `docs/GAP-ANALYSIS.md`, `docs/FEATURE_BUILD_PLAN.md`,
  `docs/CHECKLIST.md`, `docs/CONTRACT_SPEC_HANDOFF.md`, `build_instructions_phase_2/**`
  — completed or superseded planning artifacts
- `docs/IDENTITY_MODEL_ANALYSIS.md` — its "kill these 4 empty tables" table was
  **reversed** by ECOSYSTEM_PLAN §F5 (they're empty but code-referenced — keep)
- `docs/TOKEN_DICTIONARY.md` — still the token contract, but its `ORD.*` namespace
  points at the retired orders spine
