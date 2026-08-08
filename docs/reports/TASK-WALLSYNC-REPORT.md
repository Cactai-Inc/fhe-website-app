# TASK WALLSYNC — report

**Thread:** WALLSYNC · **Branch:** `task/wallsync` · **Worktree:** `wt-wallsync`
**Base:** `origin/main` @ `38c2b05`. The brief said `267fc97`; `origin/main` had moved one
commit ahead to `38c2b05` (`docs: thread registry`, docs-only, contains `267fc97`). I
branched off current `origin/main` rather than a detached older commit. Flagging it
because it differs from the brief.

**Applied to production** (`lrstswfxfsezdmvkvukc`): both Bug B migrations, dry-run first,
raw output below.

---

## Outcome in one line

Madeline Do is **released** — the two documents she was told to re-sign were never asked
of her by any human. Sarah and Mary are unchanged. The wall and the onboarding page now
compute satisfaction from **one shared function**, and the deadlock is impossible by
construction rather than by two authors remembering the same rule.

| person | wall before | wall after | onboarding actionable before → after | state |
|---|---|---|---|---|
| Sarah Morgan | `false` | `false` | 0 → 0 | released (by Bug A, already applied) |
| **Madeline Do** | **`true` (2)** | **`false` (0)** | **0 → 0** | **deadlock cleared** |
| Mary Richardson | `true` (6) | `true` (6) | 6 → 6 | **unchanged** — D8 Stage-2 case intact |
| CJ Z (`admin@fhequestrian.com`, staff) | `false` | `false` | 0 → 0 | unchanged |
| CJ Z (`cjzigs@icloud.com`, test id) | `false` | `false` | 0 → 0 | unchanged |

Invariant — *if the wall blocks, the onboarding page shows ≥1 actionable item* — holds for
**every contact**, before and after. It was violated by exactly one contact before
(Madeline); zero after.

---

## I have to flag a contradiction in the brief before anything else

The brief states two things that cannot both be true:

> "The fix inverts what you might assume: make satisfaction VERSION-BLIND … the demands
> are manufactured by the wall itself."

> "Madeline must end up still walled (she genuinely owes two re-signed documents)."

If the demands are manufactured by the wall, Madeline does not genuinely owe anything.
Her four assigned documents are all `EXECUTED` and non-superseded; her two "blockers" were
*purely* version comparisons. A version-blind gate releases her — it cannot leave her
walled. The spec's own corrected section says so explicitly:

> "it **releases Madeline** and the 8 latent cases without asking anyone to sign anything
> they were never asked for."

The residual "still walled" wording is `## Verification` item 3, which is pre-correction
text the correction did not sweep. **I followed the CORRECTED section**, per the brief's
tie-break rule and because it is the owner's own words with a stated outcome.

**I did not simply drop the acceptance test.** I made it reachable and then proved it: the
"Madeline walled with exactly those two listed" state is exactly what happens when a
*human* demands the re-signature. Raw proof in §5 — she is walled with precisely
`HUMAN_EMERGENCY_MEDICAL` + `RELEASE_PARTICIPANT`, and the generator produces two fresh
signable drafts so she can finish and get out. That path now works; it just isn't fired by
editing text. Nothing was demanded of anyone — that run was rolled back.

---

## 1. Bug A — verified, not redone

Already applied by the orchestrator (`20260807T1200_backfill_signed_template_version_zero.sql`).
Verified with my own queries:

```
 signed_v | count            -- EXECUTED, non-deleted documents
----------+-------
 1        |    37
 2        |    15
 3        |     3

 remaining_zero_or_null
------------------------
                      0
```

Zero rows remain at `0` or `NULL`, so the `coalesce(0, …) >= 1 → false` trap has no
remaining rows to bite. `COMPANY_POLICIES` (12) and `FACILITY_RULES` (13) all sit at
`signed_v = 1` against templates that have only ever been version 1.

Sarah's live-negotiation document is untouched, then and now:

```
                  id                  |       status       | current_status  | signed_template_version
--------------------------------------+--------------------+-----------------+-------------------------
 704c8d2d-d179-43f9-8a4a-7ea8cb920ab9 | AWAITING_SIGNATURE | sent_for_review  |
```

It was never in scope of the backfill (`status = 'EXECUTED'` never matched it), and its
`updated_at` is `2026-08-05`, before the backfill ran. **I did not write to it.**

*Assumed, not verified:* that the backfill's affected count was exactly 19. I could not
observe the UPDATE — it had already committed. What I can prove is the end state (0
ambiguous rows) and that the migration's own guard would have aborted on any row belonging
to a template past version 1.

## 2. What I found that changes the shape of the fix

Three findings from reading the live DB, none of which are in the brief:

**(a) It was four copies of the rule, not two.** `generate_my_onboarding_documents()` also
decides satisfaction, version-blind, and `my_onboarding_state()` carried a *second* inline
copy in its `horse_needed` branch. Only `contact_document_wall_state()` was version-aware.

This is decisive: the generator refuses to produce a replacement while an executed
non-superseded copy exists. So "make the onboarding page version-aware" — the pre-correction
plan — was **structurally impossible**: it would have listed two documents for Madeline that
the system would then refuse to generate. She would have been shown two items she could
never sign. The correction is not just the owner's preference; it is the only self-consistent
direction.

**(b) A deliberate owner-decision workflow already exists, and the wall was pre-empting it.**

```
record_template_version_bump()  (trigger)  → logs every bump to template_version_events
pending_version_decisions()                → puts it in front of staff
resolve_version_decision(event, ALL|SELECTED|NONE)  → the human answer
require_resign_from(key, contacts[])       → creates the obligation
```

All **6 events from the 2026-08-02 contract sprint are still `resolved_at IS NULL`.** Nobody
has decided that anyone must re-sign. The wall was enforcing a decision that had been
correctly queued and never made. That is the owner's complaint, confirmed in the data.

**(c) `require_resign_from()` was already partly broken, and version-blindness would have
finished it off.** Its mechanism was to insert a `contact_required_documents` row and rely
on the wall's version comparison — its own comment says so. But the insert is
`ON CONFLICT DO NOTHING`, so for anyone who *already* held the assignment (everyone the
onboarding flow has touched, Madeline included) it wrote nothing. `resolve_version_decision`
would report *N people required* and create zero real obligations. Remove the version
comparison and it becomes a total no-op.

I did **not** ship a version-blind gate on top of that. See §4.

## 3. Migration 1 — the one predicate

`supabase/migrations/20260807T1500_wallsync_shared_satisfaction_predicate.sql`

```sql
contact_document_satisfied(p_contact_id uuid, p_template_key text) RETURNS boolean
```

Version-blind: any `EXECUTED`, non-superseded, non-deleted document for the assigned
`template_key` satisfies it. Now called by all of:

- `contact_document_wall_state()` — the version comparison is **gone**
- `my_onboarding_state()` — both the documents loop and the `horse_needed` branch
- `generate_my_onboarding_documents()`

Also adds `wall_onboarding_invariant_violations()`, which must always return zero rows, and
the migration **aborts itself** if it does not. The invariant is now true by construction —
the wall's set is a strict subset of the onboarding page's set (same `crd` rows, further
filtered to active wall-gating templates) and both apply the same predicate — but the
function makes that checkable rather than merely argued.

One behavioural addition: `my_onboarding_state()` can now emit status `RESIGN_REQUIRED` for
a document that is executed but not satisfying (superseded evidence, or an explicit staff
demand). Previously such a row could read `EXECUTED` while the wall disagreed — that *is*
the deadlock. The UI treats every non-`EXECUTED` status as actionable
([Onboarding.tsx:368](src/pages/app/Onboarding.tsx#L368), [:548](src/pages/app/Onboarding.tsx#L548),
[:1012](src/pages/app/Onboarding.tsx#L1012)), so it renders as a signable item with no frontend change.

**`signed_template_version` is not written by either migration.** The gate changed; the
evidence did not.

## 4. Migration 2 — making the deliberate path actually work

`supabase/migrations/20260807T1510_wallsync_explicit_resign_is_supersession.sql`

I did **not** add the per-template "signatures below version N must re-sign" marker the spec
sketched, and the brief's instruction to ask you first is therefore moot — **the mechanism
already exists**. `staff_assign_documents()` forces a re-signature by *superseding* the
executed copy:

> "every executed, non-superseded copy that would still satisfy the requirement is
> superseded (retained as evidence), so the assignment ALWAYS produces a pending requirement."

That works perfectly under a version-blind gate, it matches your standing rule that
re-signing supersedes and *retains*, and it leaves `signed_template_version` untouched. So
`require_resign_from()` now uses that same mechanism instead of inventing a second, weaker
one. Forcing a re-signature is an explicit human act either way:

- staff re-assigning on the client record → `staff_assign_documents()`
- staff answering a version prompt ALL/SELECTED → `resolve_version_decision()` → `require_resign_from()`

and never an inference from a template edit.

Two smaller corrections in the same migration:

- `require_resign_from()` now returns the number of contacts who **genuinely owe** the
  document afterwards, so `template_version_events.people_required` records the truth rather
  than a count of fresh INSERTs (previously often 0).
- `template_past_signers.already_required` meant "an obligation row exists", which is true
  for every member the onboarding flow ever touched and told staff nothing. It now means
  "does this person owe the document right now", via the shared predicate.

**This migration demands nothing of anyone.** It changes what `require_resign_from()` will do
when next invoked. The 6 unresolved version events are untouched — whether the 2026-08-02
body changes were material enough to require re-signatures is your call and counsel's.

**Revertability:** the two migrations are independent. Migration 2 only rewrites two function
bodies and can be reverted by restoring them, without touching migration 1. Migration 1 can
be reverted by restoring the four function bodies from `origin/main`. Neither has a schema
or data change to unwind. Standing caveat from `CLAUDE.md` applies: like ~31 existing
migrations these rewrite function bodies and are not replayable on a fresh database.

## 5. Verification — raw output

### 5.1 Dry-run (`BEGIN … ROLLBACK`), both migrations

```
#### applying migration 1
CREATE FUNCTION / COMMENT / CREATE FUNCTION x4 / COMMENT / DO
#### applying migration 2
CREATE FUNCTION / COMMENT / CREATE FUNCTION / DO

#### AFTER — invariant violations across ALL contacts (must be 0 rows)
 contact_id | person | wall_gating | onboarding_actionable
------------+--------+-------------+-----------------------
(0 rows)

#### AFTER — every walled contact and their actionable count
     person      | wall_gating | actionable
-----------------+-------------+------------
 Anita Tackette  |           4 |          4
 Mary Richardson |           6 |          6
(2 rows)

#### AFTER — row counts unchanged?
 documents_same | signatures_same | crd_same
----------------+-----------------+----------
 t              | t               | t

#### AFTER — any document status / current_status / signed_v / deleted_at changed? (must be 0 rows)
 id | old_status | new_status | old_cur | new_cur | old_v | new_v
----+------------+------------+---------+---------+-------+-------
(0 rows)
```

### 5.2 BEFORE — production, all four account holders (+ the second CJ identity)

```
=== Sarah Morgan (d226273d-b3a6-4fff-95aa-393160976c70) ===
my_wall_state()       = {"wall": false, "staff": false, "pending": 0, "staff_banner": false}
my_onboarding_state() : needed=false  profile_complete=true  horse_needed=false
  COMPANY_POLICIES         EXECUTED   f2117863-3fb2-42dd-accc-7d9533bc70dc
  FACILITY_RULES           EXECUTED   13c2b124-05ee-47a8-8bc9-ac909728072e
  RELEASE_GENERAL          EXECUTED   54665d4d-437a-4508-8395-e74eebde3f3e
ACTIONABLE (status <> EXECUTED) = 0

=== Madeline Do (ac3aecb9-bc96-4b1c-8eda-bc47b10965e8) ===
my_wall_state()       = {"wall": true, "staff": false, "pending": 2, "staff_banner": false}   <-- WALLED
my_onboarding_state() : needed=false  profile_complete=true  horse_needed=false               <-- NOTHING TO DO
  COMPANY_POLICIES         EXECUTED   ddd0d8de-55c9-4bf4-8277-4827ef6e3cdd
  FACILITY_RULES           EXECUTED   a7db9dcd-9f85-4ddc-bf1e-cc179d5960e3
  RELEASE_PARTICIPANT      EXECUTED   00fc7f26-d860-4760-929f-344cd708db59
  HUMAN_EMERGENCY_MEDICAL  EXECUTED   98120f43-4963-46ab-9a5e-f7981f82eebe
ACTIONABLE (status <> EXECUTED) = 0                                                           <-- DEADLOCK

=== Mary Richardson (d9f57a2f-d009-46dd-a77c-bcc2803c7e85) ===
my_wall_state()       = {"wall": true, "staff": false, "pending": 6, "staff_banner": false}
my_onboarding_state() : needed=true  profile_complete=true  horse_needed=true
  COMPANY_POLICIES / FACILITY_RULES / RELEASE_PARTICIPANT /
  RELEASE_HORSE_CARE / HUMAN_EMERGENCY_MEDICAL / HORSE_EMERGENCY_VET   all DRAFT
ACTIONABLE (status <> EXECUTED) = 6

=== CJ Z (admin@fhequestrian.com, staff) (b45a5503-89bc-489a-b012-c7fbf5c09632) ===
my_wall_state()       = {"wall": false, "staff": true, "pending": 0, "staff_banner": false}
my_onboarding_state() : needed=false  profile_complete=false  horse_needed=false
documents = []   ACTIONABLE = 0

=== CJ Z (cjzigs@icloud.com, test id) (0a7fc801-5b17-41f5-b379-11982030d182) ===
my_wall_state()       = {"wall": false, "staff": false, "pending": 0, "staff_banner": false}
my_onboarding_state() : needed=false  profile_complete=true  horse_needed=true
  6 templates, all EXECUTED
ACTIONABLE = 0
```

### 5.3 AFTER — production, applied

```
=== Sarah Morgan ===
my_wall_state()       = {"wall": false, "staff": false, "pending": 0, "staff_banner": false}
my_onboarding_state() : needed=false  profile_complete=true  horse_needed=false
ACTIONABLE (status <> EXECUTED) = 0                                    [unchanged]

=== Madeline Do ===
my_wall_state()       = {"wall": false, "staff": false, "pending": 0, "staff_banner": false}   <-- RELEASED
my_onboarding_state() : needed=false  profile_complete=true  horse_needed=false
  COMPANY_POLICIES / FACILITY_RULES / RELEASE_PARTICIPANT / HUMAN_EMERGENCY_MEDICAL  all EXECUTED
ACTIONABLE (status <> EXECUTED) = 0                                    [wall and page now agree]

=== Mary Richardson ===
my_wall_state()       = {"wall": true, "staff": false, "pending": 6, "staff_banner": false}
my_onboarding_state() : needed=true  profile_complete=true  horse_needed=true
ACTIONABLE (status <> EXECUTED) = 6                                    [unchanged — D8 case intact]

=== CJ Z (admin@fhequestrian.com, staff) ===
my_wall_state()       = {"wall": false, "staff": true, "pending": 0, "staff_banner": false}
ACTIONABLE = 0                                                         [unchanged]

=== CJ Z (cjzigs@icloud.com, test id) ===
my_wall_state()       = {"wall": false, "staff": false, "pending": 0, "staff_banner": false}
ACTIONABLE = 0                                                         [unchanged]
```

### 5.4 Invariant across every contact — before and after

```
BEFORE                                          AFTER (production)
     person      | gating | actionable | verdict       person      | gating | actionable | verdict
-----------------+--------+------------+--------      ----------------+--------+------------+--------
 Madeline Do     |      2 |          0 | DEADLOCK      Anita Tackette  |      4 |          4 | ok
 Anita Tackette  |      4 |          4 | ok            Mary Richardson |      6 |          6 | ok
 Mary Richardson |      6 |          6 | ok

select * from wall_onboarding_invariant_violations();   -->  (0 rows)
```

### 5.5 Row counts and non-mutation, post-apply

```
 documents | signatures | crd | superseded_executed
-----------+------------+-----+---------------------
        68 |         56 |  30 |                   0

704c8d2d-d179-43f9-8a4a-7ea8cb920ab9 | AWAITING_SIGNATURE | sent_for_review
```

Nothing was superseded by the apply. No document `status`, `current_status`,
`signed_template_version` or `deleted_at` changed (proven by the row-by-row fingerprint diff
in §5.1). Sarah's live-negotiation document is untouched.

### 5.6 The acceptance test, made reachable — an EXPLICIT staff decision (rolled back)

Staff answers the two unresolved version prompts with `SELECTED = [Madeline Do]`:

```
require_resign_from HUMAN_EMERGENCY_MEDICAL -> 1 obligation(s)
require_resign_from RELEASE_PARTICIPANT     -> 1 obligation(s)

Madeline my_wall_state()  = {"wall": true, "staff": false, "pending": 2, "staff_banner": false}
Madeline onboarding needed=true  ACTIONABLE=2
Madeline actionable items = ["HUMAN_EMERGENCY_MEDICAL", "RELEASE_PARTICIPANT"]   <-- EXACTLY THE TWO

full documents = [
  { COMPANY_POLICIES        EXECUTED         ddd0d8de-… },
  { FACILITY_RULES          EXECUTED         a7db9dcd-… },
  { RELEASE_PARTICIPANT     RESIGN_REQUIRED  00fc7f26-… },
  { HUMAN_EMERGENCY_MEDICAL RESIGN_REQUIRED  98120f43-… } ]

generate_my_onboarding_documents() -> [
  { COMPANY_POLICIES        EXECUTED  ddd0d8de-… },
  { FACILITY_RULES          EXECUTED  a7db9dcd-… },
  { RELEASE_PARTICIPANT     DRAFT     b56c6491-91bc-485d-a9ca-1ed701f07d76 },   <-- she can sign
  { HUMAN_EMERGENCY_MEDICAL DRAFT     83ccd033-5c3d-4bff-978b-bca0ff452178 } ]  <-- and get out

-- the superseded evidence: signed_template_version UNCHANGED
 98120f43-… | HUMAN_EMERGENCY_MEDICAL | EXECUTED | superseded | 1
 83ccd033-… | HUMAN_EMERGENCY_MEDICAL | DRAFT    | assigned   |
 00fc7f26-… | RELEASE_PARTICIPANT     | EXECUTED | superseded | 2
 b56c6491-… | RELEASE_PARTICIPANT     | DRAFT    | assigned   |

invariant during the demand  -->  (0 rows)
704c8d2d-…                   -->  AWAITING_SIGNATURE | sent_for_review   [untouched]
```

Walled **and** listing exactly the two she owes, with signable drafts generated, evidence
retained, signed versions preserved. **This entire block was rolled back.** No obligation
exists in production.

### 5.7 No inline copy of the rule survives

```
callers of contact_document_satisfied:
  contact_document_wall_state(uuid)
  generate_my_onboarding_documents()
  my_onboarding_state()
  require_resign_from(text,uuid[])
  template_past_signers(text)
  wall_onboarding_invariant_violations()
```

Remaining `signed_template_version` references are all correct and non-gating:
`freeze_signed_template_version()` (the trigger that *records* it),
`pending_version_decisions()` and `template_past_signers()` (advisory candidate lists for the
staff prompt), and a comment in `require_resign_from()`. **No function gates access on a
version comparison any more.**

## 6. The `Documents` error swallow — fixed

The brief points at `Documents.tsx`. That file is now an 18-line wrapper; the load moved to
[DocumentsContent.tsx](src/components/app/DocumentsContent.tsx) (TASK-ACCOUNTSURFACE §3).
Fixed there:

- `Promise.all([myDocuments().catch(() => []), listMySignableDocuments().catch(() => [])])`
  → `Promise.allSettled`, so one failing source no longer blanks the other **and** the
  failure is reported instead of swallowed.
- New error banner with a **Try again** button ([:381](src/components/app/DocumentsContent.tsx#L381)).
- The "No documents yet" empty state is suppressed when the load failed — that false
  negative is precisely what got this outage mis-read as a data problem.
- `handleSign`'s `myDocuments().catch(() => rows)` silently kept stale rows after a
  signature. It now reports "Your signature was saved, but this list could not be
  refreshed: …", so a saved signature is never shown as a failure, nor a failed refresh as
  success.

## 7. Files owned by other threads — not edited

- **`AppLayout.tsx`** (ONEMENU) — **no change needed.** The wall is at
  [AppLayout.tsx:819](src/components/app/AppLayout.tsx#L819), not 684 (the file has moved on).
  It reads `myWallState()` and redirects; the fix is entirely in the DB predicate, so its
  behaviour changes correctly with no edit. Its existing FAIL-CLOSED handling is intact.
- **`ClauseDocument.tsx`** — frozen, untouched, not involved.

## 8. Verified with my own eyes vs. assumed

**Verified by running it:**
- Bug A's end state (0 rows at `0`/`NULL`); Sarah's `704c8d2d` untouched before and after.
- Every before/after `my_wall_state()` / `my_onboarding_state()` in §5.2–5.3, by
  impersonating each account holder via `request.jwt.claims` in-session.
- Madeline's four documents are all `EXECUTED` + `signed`; her two blockers were version
  comparisons only.
- All 9 active wall-gating templates were bumped `2026-08-02 16:59`; Madeline signed
  `2026-07-10`.
- All 6 `template_version_events` are unresolved.
- The full invariant scan over every contact, before and after.
- Row counts and the row-by-row document fingerprint diff.
- The §5.6 explicit-re-sign proof end to end, including document generation.
- `npm run typecheck`, `typecheck:api` clean; `npm run lint` → **0 errors, 30 warnings**,
  byte-identical to `origin/main`'s baseline measured in the same session.

**Assumed, not verified:**
- That the Bug A backfill touched exactly 19 rows. It had already committed; I can only
  prove the end state.
- **No browser click-through.** I did not log in as Sarah or Madeline and click to
  `/app/documents`, the community feed, or document `704c8d2d`. Verification item 2 is
  satisfied at the RPC layer only — `my_wall_state().wall == false` is what
  [AppLayout.tsx:819](src/components/app/AppLayout.tsx#L819) branches on, so the redirect
  will not fire, but I did not watch it not fire. The `RESIGN_REQUIRED` status renders as
  actionable by code reading of `Onboarding.tsx`, not by observation — and it appears in
  production only after an explicit staff re-sign decision, of which there are currently none.
- The 8 latent cases: I measured **8 people / 18 documents** holding signatures the old gate
  treated as stale (the brief says 10/20 — that count predates the Bug A backfill, which
  legitimately cleared some). Only Madeline had the assignment, which is why only she was
  walled; the other 7 would have been walled on assignment or first login. I did not
  simulate each of their logins.

## 9. For the owner — one decision left, unchanged by this work

The 6 template version bumps from 2026-08-02 are still **unresolved** in
`template_version_events`, exactly as they were. Nothing now forces them either way.

Whether any of those body changes were material enough to require past signers to re-sign
is your call. When you decide, the path is `pending_version_decisions()` in ops →
answer `ALL` / `SELECTED` / `NONE`. As of migration 2 that answer now actually takes effect,
which it did not before.

`NONE` is recorded, not dismissed — it is a real decision and stays auditable.
