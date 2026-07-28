# Session handoff — start here

**Read `/CLAUDE.md` first** — it describes the live spine, the retired concepts, the
migration convention, and the settled owner decisions (D1–D9). This file is the
shorter orientation: where the system stands and what is worth doing next.

---

## Where things stand

The platform runs on one identity spine and one deliverable spine.

**Identity.** A person is a `contacts` row; an account is a `profiles` row bridged to
`auth.users`. `promote_contact_to_account` is the single path from one to the other
and the only writer of `profiles.contact_id` — every account-creation entry point
(invitation redemption, contract-counterparty redemption, self-signup, gift
redemption, kiosk signing) routes through it. Standing affiliations live in `groups`
and are DERIVED from executed documents and horse ownership, never hand-written:
`apply_affiliations` is their sole writer, kept current by triggers.

**Access.** Community follows the ACCOUNT (D8) — any account holder participates.
Documents gate ACTIONS, not access: the general release gates physical visits, the
participant release gates riding, the horse-care set gates care services. A member
with unsigned onboarding-class documents meets the signing wall on sign-in until they
are signed; staff are never hard-walled.

**Commerce.** Flat SKUs in `offerings` (no tier layer). A purchase creates
`purchase_items`, which generate `fulfillment_units` by `config_kind` — the ledger of
what was promised and what has been delivered. Bookings consume units. Receipts are
logged per attempt and cannot double-send.

**Multi-tenancy.** Every tenant-facing surface is org-scoped, and platform-tier
accounts (`SUPER_ADMIN` or null `org_id`) are structurally excluded from tenant
listings by RLS.

---

## How to work here

- **DB connection:** first line of `.env.db` (gitignored). Use
  `psql "$CONN" -P pager=off -c "…"`.
- **Migration discipline:** dry-run inside `BEGIN; … ROLLBACK;` against prod → apply →
  verify with a query → commit. There is no `schema_migrations` table; migrations are
  a hand-maintained journal.
- **Caveat:** many migrations rewrite existing function bodies in place
  (`pg_get_functiondef` + string-replace + re-execute), so the history is **not
  replayable from scratch** on a fresh database.
- **Commands:** `npm run typecheck`, `npm run typecheck:api`, `npm run lint`,
  `npm run build`.
- **Baseline health:** typecheck 0 errors, `typecheck:api` 0 errors, lint 0 errors
  (26 pre-existing warnings).

---

## What is worth doing next

`docs/BACKLOG.md` is the standing list. The largest items:

1. **Business admin suite** — the migration is written but deliberately unapplied: it
   contains a wrong MRR calculation (a lifetime sum mislabelled "monthly") and a
   misleading member KPI. Fix both before applying, then build the sales / expense /
   growth / KPI surfaces and the PDF + CSV generators.
2. **The DB test suites have never been executed.** They were re-targeted onto the
   current schema but need a dedicated test database to run; several were already
   stale before that.
3. **The fulfillment spine has only been exercised synthetically** — `purchases` is at
   0 rows, so its first real test is the first real purchase.
4. The deferred UI items (calendar day/list modes, stable item form fields, the
   Landing CTA, the dead Brokerage nav route, chat-with-us, SEO, hero content, and a
   mobile device pass).

---

## The one rule that matters most

**Verify against the live database and code before asserting, and claim only what the
diff contains.** Plausible-sounding structural claims have repeatedly been wrong here:
a column that looked load-bearing was vestigial; "empty" tables were wired and
code-referenced; same-named contact records were different people; a write that
reported success was silently blocked. Query first, then state.
