# CLAUDE.md — orientation for a working session

**Read this first.** It describes what the system actually is: the live spine, the
retired concepts, the migration convention, and the settled owner decisions.

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
- `members` = the access gate; `is_active_member()` reads it, and RLS on ~10
  community tables depends on that. The word "membership" is deliberately reserved
  for a future real product (D4), so there is no tier column.
- `groups` (contact_id, group_type) = standing affiliations, RIDER / HORSE_OWNER /
  PARENT_GUARDIAN only. `clients.client_since` / `.customer_since` are the two D8
  markers (service engagement vs commercial purchase) on one account.
- **Promotion is one path:** `promote_contact_to_account(user, contact)` — the SOLE
  writer of `profiles.contact_id`. It links or merges (evidence-based survivor),
  re-anchors documents/parties/signatures, grants membership, and derives groups.
  A structural denylist refuses the protected identities and any company contact.

**Affiliation groups are DERIVED, never hand-written.** `derive_affiliations(contact)`
computes them from executed documents + horse ownership; `apply_affiliations(contact)`
is the **sole writer** of RIDER / HORSE_OWNER / PARENT_GUARDIAN rows, kept live by
triggers on document-execution and horse-ownership. If you find code writing those
roles directly, that's a regression — route it through `apply_affiliations`.

**Fulfillment:** `fulfillment_units` are generated from `purchase_items` by
`config_kind` (scheduled→session, recurring→period, intake_*→milestone,
document_transaction→execution, inquire→none). Bookings consume them; evaluation
delivery satisfies milestones; `status_events` drives unit state.

**Documents:** assignment is `contact_required_documents` (the "pending set" is a
QUERY, not a table). `contract_templates.wall_gating` marks the onboarding class
that gates a member's session — `my_wall_state()` drives the signing wall; staff are
never hard-walled. A newer version executing marks the prior one `superseded`
(retained as evidence). Signatures carry `signer_user_id` from Stage 2c.

**Other live subsystems:** `status_events` + `status_events_vocab` (+ `current_status`
denormalized on documents/purchases/bookings/invitations, maintained by triggers);
`evaluation_reports` (+ `_shares`, `_access`); invitation lifecycle
(`record_invitation_failure`, `supersede_invitations`, `invitation_expiry_days`);
`_ensure_client_account` (the contact-side account spine); `receipt_sends`
(one row per attempt; a receipt is provable and single); `purge_account` (allowlisted
account removal, staff-invoked only).

---

## RETIRED — do not resurrect

Tables/concepts: `engagements`, `orders`, `client_purchases`, `lesson_sessions`,
`transactions`, `contact_roles` (now `groups`), `horse_parties` (now
`horse_relationships`), `staff_profiles` (merged into `profiles`), offering **tiers**,
`members.tier`, welcome/dunning email (D9).
Functions: `start_broker_contract`, `dunning_due`, `mark_dunning_sent`.
Files: `src/lib/services.ts`, `src/lib/catalog.ts` (the two hardcoded shadow
catalogs — the catalog is DB-driven), `src/components/order/OrderDocuments.tsx`.

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

Verify against the live database/code **before** asserting, and claim only what the
diff contains. This codebase has repeatedly contradicted plausible-sounding
assumptions (a column that looked load-bearing was vestigial; "empty" tables turned
out to be wired and code-referenced; same-name contact records turned out to be
different people). Query first.

**Writes must prove they landed.** Supabase returns no error when RLS filters an
UPDATE to zero rows. Every write goes through `assertWrote()`
(`src/lib/writeGuard.ts`) with a `.select()` so a blocked write throws instead of
reporting success.

---

## The docs

- `docs/BACKLOG.md` — the standing work list (the only place to look for what's next)
- `docs/TOKEN_DICTIONARY.md` — the document merge-token contract
- `docs/NOTIFICATIONS.md`, `docs/GOOGLE_SMTP_SETUP.md` — the email/notification setup
- `docs/DUAL_IDENTITY_TRACE.md` — how act-as-company works (D7's behavioral contract;
  any change to company-vs-personal attribution must be diffed against it)
- `docs/contract-exports/` — generated from the live lease template
- `supabase/contract_templates/HORSE_LEASE.md` — how to edit the lease (pointer doc)

---

## Settled owner decisions — inherit these, do not re-ask

- **D1 — Identity disposition.** admin@fhequestrian.com (CJ) + hello@fhequestrian.com
  (Claire) + the company contact (French Heritage Equestrian) are PRODUCTION FHE
  identities. admin@cactai.io is the PLATFORM owner (Cactai Inc, super admin) — never
  an FHE tenant identity; must hold zero FHE tenant rows. cjzigs@ / charlesjzigmund@
  are the owner's test identities: live and untouched until the owner-run post-Stage-5
  purge (via the 5g routine, never ad hoc). The 6 stranded executed documents ride on
  the test identities and exit with that purge — no re-anchoring.
- **D1a — The platform owner is not a tenant (2026-08-10).** Sharpens D1, does not
  supersede it. `admin@cactai.io` = PLATFORM owner, `org_id` **NULL by design**, and
  **not a member of any tenant**. `admin@fhequestrian.com` = TENANT owner. They are
  different things and are never merged. **Consequence: being DENIED by FHE
  staff-gated functions is CORRECT for the platform account, not a bug.** Three
  threads reported it as breakage; all three were wrong. `has_staff_access() AND
  v_org = current_org()` goes NULL for it, so the `IF` skips and it is admitted —
  *that admission was the accident.* All `coalesce(…, false)` repairs on those ~48
  functions are therefore **safe**. **Do NOT set `org_id` on `admin@cactai.io`** — it
  was proposed as the cheap fix and is refused. Full ruling:
  `docs/reference/D1a-PLATFORM-OWNER-IS-NOT-A-TENANT.md`.
- **D2 — Rename.** The affiliation table becomes `groups`.
- **D3 — Purchaser wording.** DB stores a neutral promotion marker; display "client"
  in staff/ops surfaces, "customer" only in gift/product-only contexts. Members must
  see "Member" about themselves and each other — never "Client".
- **D4 — Membership tiers DEFERRED** as a product. Strip tier-implying copy
  (monthly/annual); billing schedules + implicit pay-as-you-go are current reality.
  `tier` stays a reserved word.
- **D5 — Promotion pathway.** `promote_contact_to_account` = `_ensure_client_account`
  spine + re-anchor documents/parties/signatures + `apply_affiliations` + dissolve the
  faceless contact. Real users only; D1's protected/test identities are never dissolved.
- **D6 — Fulfillment = one deliverable spine.** Every `purchase_item` with a
  `config_kind` produces fulfillment unit rows; `status_events` drives their state;
  receipts, dunning, and delivery logging hang off the spine as provable events.
- **D7 — Dual-identity (act-as-company) is protected behavior.** Both staff accounts
  act as themselves or as the company (displayed AND recorded). It works via patches
  today; consolidation only as behavior-identical change against the Stage-1 trace
  (`docs/DUAL_IDENTITY_TRACE.md`), never blind.
- **D8 — Access model (owner-final 2026-07-27; supersedes "guest = account with no
  group" as a derivation).** (1) Community access is gated by ACCOUNT, not documents —
  any account holder views and participates. Documents gate ACTIONS: RELEASE_GENERAL
  gates physical visits (signed at visit, kiosk-style); the participant release gates
  riding; the horse-care set gates care services. GUEST is never a derived group —
  "guest" is display-only for an account with no service group. (2) CUSTOMER =
  commercial marker for any purchaser incl. gift buyers; a gift purchase auto-creates
  the account through the single spine (no manual provisioning) with order visibility,
  repurchase, community access, and marketing eligibility. CLIENT = service-engagement
  marker, attached at invitation with service documents. Customer→client promotion is
  a marker change on the same account. (3) An account with assigned-but-unsigned
  documents is PENDING: service features locked until executed, community open,
  surfaced in ops needs-attention. (4) Mary Richardson is untouched — she is the
  Stage 2 live acceptance case (supersede expired invite → re-invite → sign → derive
  RIDER + HORSE_OWNER). (5) Linked accounts (separate logins, shared
  horse_relationships-based record via add-by-email, rider-permission-gated schedule
  visibility) are recorded scope, not built: record-sharing folds into Stage 3's
  horse-visibility item; schedule-sharing is BACKLOG-deferred. The gift auto-account
  lands with Stage 4's gift work on the Stage 2 spine.
- **D9 — The email chain ends at setup.** There is NO welcome email and NO dunning
  email. The invitation IS the welcome; the document-flow completion email IS the
  account-setup confirmation. Payment is prepaid-gated (no payment, no service), so
  overdue reminders have no business function. Both producers are deleted, not
  dormant. `profiles.payment_reminders` survives as a vestigial column with no
  reader.
