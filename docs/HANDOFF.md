# Session handoff — start here

**Written 2026-07-27 to open a fresh session thread.** The previous thread got long
enough that context conflicts were a risk; this document replaces it.

---

## Read these first, in this order

1. **`/CLAUDE.md`** — the live spine, what's RETIRED (do not resurrect), the migration
   convention, and a doc-trust ranking. **Most other docs in this repo are historical
   and will mislead you** — they're in `docs/archive/` with warning headers.
2. **`docs/BACKLOG.md`** — the standing work list (blocked / ready / defects).
3. **`docs/ECOSYSTEM_PLAN.md`** — the in-flight refactor (Stages 0–2 done, 3–6 to go).
4. **`docs/STATUS_REPORT.md`** — the point-in-time record of what shipped.

---

## Current state in one paragraph

`main` is at `1c01b32` and **the code now matches the live production database** (the
branch was pushed 2026-07-27; a drift audit confirmed all 36 objects the session's
migrations create are live, with no reverse drift). Working tree is clean. Typecheck 0
errors, lint 0 errors (~26 pre-existing warnings). Four feature phases shipped
(client-lifecycle, per-horse care gating, invitation lifecycle + status model,
offering configuration + evaluation reports), plus a `membership`→`member` rename and
the first three stages of an identity/taxonomy refactor.

---

## What the identity refactor is about (the important context)

The invite path kept needing patches. The reason, verified in code: **a person's
category was written by five different functions with nothing reconciling them, and
documents carried no account link.** So a kiosk signer and an invite user ended up in
different, contradictory states — e.g. someone who had signed the *complete
horse-owner document set* held zero group roles, while six people who signed the rider
set were tagged GUEST-only.

**Fixed (live):** `derive_affiliations(contact)` computes a person's groups from their
executed documents + horse ownership; `apply_affiliations(contact)` is now the **sole
writer** of RIDER / HORSE_OWNER / PARENT_GUARDIAN, kept current by triggers on
document-execution and horse-ownership. Live state: **RIDER 9 · HORSE_OWNER 2**.

**If you find code writing those role rows directly, that's a regression** — route it
through `apply_affiliations`.

---

## The owner's canonical taxonomy (authoritative — don't re-derive it)

- **Two identity anchors, one person in one at a time.** `contacts` = faceless
  external persons only (a vendor; a tracked website visitor with an id who hasn't
  closed the loop with a real identity). **Account** (`profiles` ↔ `auth.users`) =
  anyone who participates. Promotion moves a person contact → account carrying their
  history. **No dual-association, no duplicated data.**
- **Guest / Rider / Horse-owner ALL have accounts** and can see + contribute to
  community. Guest is *not* the outer ring — it's an account holder with no
  affiliation group (farm visitor, gift-certificate buyer).
- **An account is required** to own a horse or be a contract party. All contracts are
  horse transactions, so every party is a horse owner or a rider (seller/lessor =
  horse owner, possibly also rider).
- **`group`** = the canonical word for stacking affiliation (RIDER, HORSE_OWNER,
  PARENT_GUARDIAN). **`role`** = internal users only (staff/instructor/admin).
  **`contact_type`** = kinds of faceless external. Buyer/Seller/Lessee/Lessor are
  **per-document** roles, not groups.
- **`tier` is dead** (always `'community'`, display-only) — the word is deliberately
  reserved for a future real membership-with-tiers product. Same reasoning drove the
  `membership` → `member` rename.
- **Empty tables are not dead tables.** Several are empty only because their flows
  aren't reachable yet, and each is still code-referenced. Do not drop
  `lease_participants`, `horse_parties`, `document_party_archives`, or
  `content_acknowledgments`.

---

## Two decisions the owner still owes you (they block Stage 4)

1. Affiliation table name: **`groups`** (recommended) vs `member_groups` vs
   `client_groups`.
2. Purchaser wording: `client` for everyone / `client` + `customer` split /
   `guest` + `customer`. ("Client" implies an ongoing service relationship; a
   gift-certificate buyer is literally a one-off customer. The owner was weighing the
   literal accuracy against a personable community tone.)

A third is blocked on the owner: **Stage 3** would move 6 stranded *signed* documents
between the owner's own multi-role test identities — destructive, needs an explicit
canonical-identity call.

---

## Suggested next moves (highest leverage first)

1. **Fix + ship the business admin suite.** The migration is written but
   deliberately unapplied because it contains a **wrong MRR calculation** (a lifetime
   sum mislabelled "monthly", for a product that doesn't exist) and a **misleading
   member KPI** (counts activated accounts incl. staff). Fix both, apply, then build
   sales / expense / growth / KPI surfaces + the PDF and CSV generators. Highest owner
   value, self-contained, and the `KpiTile` framework already exists.
2. **The two legal/financial-risk defects** — placeholder legal text in order
   documents, and receipts having no logging or idempotency. Both are small and both
   carry real exposure.
3. **Ecosystem Stage 4** once the naming decisions land.
4. **The quick UI defects** — the `o.tiers` bug in `AttachOfferingPanel`, the dead
   gift-redeem button, the Landing CTA pointing at `/story` instead of the funnel, the
   dead brokerage nav route. Each is independently shippable.

---

## How to work in this repo

- **DB connection:** first line of `.env.db` (gitignored). Use
  `psql "$CONN" -P pager=off -c "…"`.
- **Migration discipline:** dry-run inside `BEGIN; … ROLLBACK;` against prod → apply →
  verify with a query → commit. There is no `schema_migrations` table; migrations are
  a hand-maintained journal.
- **Caveat:** ~31 migrations rewrite existing function bodies in place
  (`pg_get_functiondef` + string-replace + re-execute). They silently no-op on a fresh
  database, so the history is **not replayable from scratch**. Pre-existing.
- **Commands:** `npm run typecheck`, `npm run typecheck:api`, `npm run lint`,
  `npm run build`.

---

## The one working rule that matters most here

**Verify against the live database and code before asserting anything.**

In the previous thread I repeatedly stated plausible-sounding structural claims that
the data then contradicted: that a column was load-bearing when it was vestigial; that
double-keyed columns were redundant when they were merely unused; that three
same-named contact records were one duplicated person when they were three different
accounts; that empty tables were safe to delete when they were still wired; and that a
retired template file was a stale trap when it had already been rewritten into a
useful how-to-edit guide. Every one of those was caught by running a query instead of
trusting the inference.

The owner is a reliable source of domain truth and will correct you directly. Take the
correction, re-verify, and move on — but don't make them do the verification for you.
