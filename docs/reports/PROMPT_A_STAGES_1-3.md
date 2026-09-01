# PROMPT A — STAGES 1–3 REPORT AND HANDOFF

**Run date:** 2026-08-01
**Branch:** `work/u1-lead-trust`
**Database:** `lrstswfxfsezdmvkvukc` (production), reached via the first line of `.env.db`
**Commits:** `0975671` (Stage 1) · `c0b1ad8` (Stage 2) · `1c78249` (Stage 3)
**Ended at:** owner instruction — Stages 4 and 5 deliberately NOT started.

This file is the handoff. The Stage 4–5 session reads state from here and from
the repo, not from a transcript.

---

## 1. STATUS TABLE

| Stage | Unit | Status | Commit |
|---|---|---|---|
| 1 | U1 — lead trust + notification integrity | **DONE**, 6/6 items dispositioned | `0975671` |
| 2 | U2 — contract polish + type correctness | **DONE except U2.7(b)**, which is blocked | `c0b1ad8` |
| 3 | U3 — payment notifications | **DONE**, live cycle verified | `1c78249` |
| 4 | U4/U5 — hardening + insurance | **NOT STARTED** | — |
| 5 | U7 — Stage B legacy retirement | **NOT STARTED** | — |

### Per-item detail

| Item | Anchor vs live | Outcome |
|---|---|---|
| U1.1 re-invite destroys docs | matched exactly | fixed (1a/1b/1c) |
| U1.2 request↔contact link | `contact_id` absent, id discarded | fixed; backfill 9 matched / 0 unlinked |
| U1.3 LEAD→CONTACT | **5 NULL rows, spec said 1** | owner-ruled; backfilled, NOT NULL set |
| U1.4 redemption dead-end | scan@6205 after UPDATE@1581 | fixed; scan now precedes all mutation |
| U1.5a–d notification lifecycle | matched | fixed |
| U1.5e NULL links | **ANCHOR ABSENT — 0 rows live** | report-only + BACKLOG |
| U1.6 hardcoded hostname | **fallback, not hardcode** | fixed; 2 out-of-scope strings reported |
| U2.1 currency | **plan wrong on both halves** | fixed; 5 rows repaired, 2 frozen |
| U2.2 foaling label | matched | fixed (V2 only; v1 is dead) |
| U2.3 medication tokens | **no "mode argument" exists** | per-component resolvers added |
| U2.4 EFFECTIVE_DATE | matched | unified to remerge's source |
| U2.5 location address | matched | composed; stutter suppressed |
| U2.6 token registry | **97 "orphans" were 20, then 0** | 6 dead rows removed; rest cleared |
| U2.7a CI token guard | n/a | built, demonstrated both directions |
| U2.7b golden-render suite | n/a | **BLOCKED — harness cannot build a DB** |
| U2.8 deductible gating | matched | **STAGED ONLY, not applied** |
| U3 payment notifications | matched | built, live cycle verified |

---

## 2. DECISIONS

Every deviation from a spec, with the evidence that forced it.

### D1 — Item 3: five NULL `contact_type` rows, not one
Spec asserted one (Gabriella). Live count was **5**.

```
07ab7dbf  (no email)          Charles Zigmund    2026-07-03
d268330c  cjzigs@icloud.com   Charles Zigmund    2026-07-07
bb57e418  (no email)          Unnamed Contact    2026-07-14
6ecceaf0  (no email)          Unnamed Contact    2026-07-16
3c23bb7f  (no email)          Gabriella Olenik   2026-07-26
```

**Owner ruling:** backfill all five to `CONTACT` and proceed to `SET NOT NULL`.
All five are test-era rows already destined for the pre-launch purge, so the
type value is transitional and `CONTACT` gates nothing. Typing them does not
resolve the duplicate/artifact question, so two BACKLOG entries were added:
the Zigmund pair (**explicitly NOT merged** — `d268330c` is the live lessor on
the reference sample draft) and the two `Unnamed Contact` artifacts.

### D2 — Item 5e: the anchor does not exist
`select count(*) from notifications where link is null` returned **0**, and
that IS item 5e's own done-check. Rewriting `notify_staff`/`notify_user`/
`mirror_admin_notification` to fix a condition that does not exist would be
changing working code on a stale premise. **Owner ruling:** report-only plus a
BACKLOG entry for prophylactic hardening.

### D3 — Item 5b: the intake link is inert
`IntakePage.tsx` reads no query params, so `?request=<id>` renders fine but does
not deep-link. The resolver needs a unique link per request or one resolve would
clear every open request's alert. **Owner ruling:** use `?request=<id>` anyway —
resolver correctness is the requirement; the deep-link is a recorded follow-up.

### D4 — Item 4: the FK scan needed COLUMN-level exclusions
Moving the scan before the mutations changes its meaning. The merge migrates 8
tables, but **52 FK columns** reference `contacts`. A table-level exclusion would
have silently skipped `documents.archived_by`, `documents.voided_by`,
`documents.originator_contact_id` and `document_shares.granted_by_contact_id` —
letting a merge proceed while leaving real dangling references, which is worse
than the original bug. Exclusions are therefore column-level.

### D5 — U2.1: the plan's premise was wrong on both halves
- `HORSE.FAIR_MARKET_VALUE` was called "the model" but **stored the formatted
  string `"$45,000.00"`**. It rendered correctly only because the symbol was
  baked into storage — the exact anti-pattern U2.1 forbids.
- Routing the lease fee through `fmt_money` alone fixes nothing: the
  `fee_schedule` branch parses a **JSON object** and every live `TXN.LEASE_FEE`
  value was a plain string. `b7446f9e` rendered `⟦NEEDS:Lease fee⟧` — a
  *missing-value placeholder*, not a formatting error. (This is almost certainly
  what the extract's "6.1 850" was.)
- `fmt_money` genuinely was never applied: `8500.5` → `"$8500.5"`.

**Owner ruling (covers the whole money class, no further stops):** status-keyed
repair. EXECUTED documents are never touched — the frozen merged body is the
instrument and the rows beneath it are historical inputs. Unexecuted documents
repair to canonical. Never invent a number.

### D6 — U2.3: there is no "mode argument"
The plan says to wire each medication token to `horse_medications_prose` "with
its mode argument". That function's `p_kind` filters `horse_medications.kind`
(live values: `MEDICATION` only) and it **already emits the full composed line**
(`name — dosage, instructions — units (day supply), $cost/order`). Reusing it for
DOSAGE and INSTRUCTIONS would repeat the whole line three more times. Added
`horse_medication_component(uuid, text)` instead. `MEDICATION_NAME` keeps the
full prose it renders today, because templates depend on it.

### D7 — U2.6: 97 "unregistered" tokens were false positives
`HORSE_LEASE_V2` has **zero** `template_tokens` rows yet renders correctly, which
proves the registry is not V2's resolver. Three mechanisms exist:

| Mechanism | Evidence |
|---|---|
| `template_tokens` (global rows have `template_id IS NULL`) | 163 global rows |
| `contract_field_defs` | resolves 81 of the 97 |
| `contract_templates.party_namespaces` | resolves the other 16 |

The audit's "known offenders" — `GUARDIAN.*`, `EMERGENCY_CONTACT.*`,
`PARTICIPANT.PRINTED_NAME`, `PARTY.*` — are **CLEARED, not wired**: they are role
expansions of the `PARTY.*` templates. The executed document `ecaecd42` contains
no raw `LESSOR.FULL_NAME`, proving resolution. `HORSE.PASSPORT_COUNTRY` and
`HORSE.REGISTRATION_ORG` belong to `HORSE_LEASE` v1 — **inactive, 0 documents**.

### D8 — U2.7(b) is blocked, and BACKLOG's stated cause is wrong
The PGlite harness cannot build a database:

```
Error: Migration failed: 20260709160000_enforce_launch_modules.sql
insert or update on table "org_modules" violates foreign key constraint
"org_modules_org_id_fkey"
  ❯ createTestDb test/db/harness.ts:147:13
Test Files  1 failed (1)   Tests  6 skipped (6)
```

That migration is from **2026-07-09**, 579 migrations before this run. Every
`test/db/*.test.ts` file is equally unrunnable. BACKLOG says the suites need "a
dedicated test database" — **that is wrong**: the harness uses in-process PGlite
and needs no external database. The blocker is one broken migration. Repairing
it is its own unit with its own verification, deliberately not improvised here.

---

## 3. RAW CHECK OUTPUT

### Stage 1

```
ITEM 1  crd count across two empty-category re-invites (contact d99f1472)
        BEFORE 6 → BETWEEN 6 → AFTER 6          (pre-fix: would delete all 6)

ITEM 1c HORSE_OWNER  -> COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET,
                        RELEASE_HORSE_CARE, RELEASE_PARTICIPANT   (5)
        'horse owner'-> identical 5-row set
        RIDER        -> COMPANY_POLICIES, FACILITY_RULES,
                        HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT  (4)
        restored to the original 6; NULL-categories derive path also 6

ITEM 2  backfill: matched_and_linked = 9
        linked 9 | unlinked 0 | unlinked_no_email 0

ITEM 3  select count(*) from contacts where contact_type is null  -> 0
        contact_type | is_nullable NO | default 'CONTACT'::text
        CONTACT 17 | TEAM 3 | LEAD 3

ITEM 4  scan_pos 5442  <  merge_update_pos 5524     (was 6205 after 1581)
        scan on a referenced contact names 12 blocking columns:
          horses.current_owner_contact_id, document_deliveries.recipient_contact_id,
          esign_consents.contact_id, contract_change_log.actor_contact_id,
          contract_fields.entered_by_contact_id, documents.horse_section_confirmed_by,
          horses.created_by_contact_id, horse_relationships.party_contact_id,
          horse_relationships.created_by_contact_id, contracts.originator_contact_id,
          purchases.buyer_contact_id, document_opened.contact_id
        control (unreferenced contact) -> "(clean — merge would proceed)"

ITEM 5a resolve_notifications_for_link(p_link text, p_actor uuid, p_kind text)
        OVERLOAD BUG CAUGHT LIVE: adding a defaulted 3rd param created a second
        function; every existing 2-arg call then failed with
          ERROR: function resolve_notifications_for_link(unknown, uuid) is not unique
        Old (text, uuid) signature DROPPED. 1-, 2- and 3-arg calls all return 0.

ITEM 5c record_signature excludes the signer -> PASS

ITEM 6  grep -rnE "https://fhequestrian\.com" api/  -> (zero)
        api typecheck exit 0
        Out of scope, reported: api/request-received.ts:9 (comment),
        api/calendar-reminders.ts:8 (comment), :21 (OPS_INBOX_FALLBACK, an
        email address, not a hostname)
```

### Stage 2

```
U2.1 money sweep — 20 money-shaped field defs across 2 templates.
     BEFORE                                              AFTER
     FMV        b7446f9e AWAITING  "$45,000.00"       -> 45000.00   renders $45,000.00
     FMV        5dbce25f AWAITING  "$45,000.00"       -> 45000.00   renders $45,000.00
     FMV        ecaecd42 EXECUTED  "$45,000.00"       -> UNTOUCHED
     LEASE_FEE  b7446f9e AWAITING  "850"              -> {"initial_due":"850"}
                                                         renders "Initial payment due: $850.00."
     LEASE_FEE  5dbce25f AWAITING  "Initial payment due: 0."
                                                      -> {"initial_due":"0"}
                                                         renders "Initial payment due: $0.00."
     LEASE_FEE  ecaecd42 EXECUTED  "Initial payment due: 0."  -> UNTOUCHED
     EVAL_FEE   5dbce25f AWAITING  "100"              -> 100        renders $100.00
     EVAL_FEE   b7446f9e AWAITING  ""                 -> unset (nothing invented)
     5 rows repaired, 2 executed rows frozen.

U2.1 render path
     json-850     -> Initial payment due: $850.00.
     json-8500.5  -> Initial payment due: $8,500.50.      (was "$8500.5")
     opt-45000    -> $45,000.00.
     prose-only   -> Initial payment due: per the schedule.   (passthrough intact)

U2.1c write guard
     currency 45000        -> ACCEPTED
     currency $45,000.00   -> rejected
     currency (empty)      -> ACCEPTED (unset)
     fee canonical JSON    -> ACCEPTED
     fee bare 850          -> rejected
     fee rendered prose    -> rejected

U2.2/2.3/2.4/2.5 live in generate_document
     U2.3 PASS: dosage wired / instructions wired / additional wired
     U2.4 PASS: now() gone
     U2.5 PASS: home composed / current composed

U2.3 components (live horses)
     full   "Adeqon — 5 mg, On the 15th of the month — N/A"
     dosage "5 mg"   instructions "On the 15th of the month — N/A"   additional ""
     full   "Zyrtec cetirizine — 10 mg, One tablet PO once daily..."
     dosage "10 mg"  instructions "One tablet PO once daily in allergy season. — ..."

U2.5 location
     was "Carmel Creek Ranch"  ->  "Carmel Creek Ranch, San Diego, CA"

U2.6 reconciliation
     body tokens with no template_tokens row .......... 97
       resolve via contract_field_defs ................ 81   no action
       resolve via party_namespaces ................... 16   no action
     registry rows appearing in no body ............... 34
       PARTY.* used via role expansion ................  7   KEEP
       DOC/FHE/ORG/ENG system+config .................. 21   KEEP
       dead everywhere ................................  6   REMOVED
     registry rows: 634 -> 628

U2.7a CI token guard
     baseline           ✓ 613 body tokens across 22 templates      exit 0
     seeded body token  ✗ HORSE_LEASE_V2 {{TXN.SEEDED_FAKE_TOKEN}} exit 1
     restored           ✓                                          exit 0
     seeded orphan row  ✗ TXN.SEEDED_ORPHAN_ROW                    exit 1
     restored           ✓                                          exit 0
     residue: 0 seeded rows, 0 seeded bodies

U2 consolidated done-check
     lease_fee_now  Initial payment due: $850.00.
     fmv_now        $45,000.00
     foaling_label  Foaling date
     location_now   Carmel Creek Ranch, San Diego, CA
```

### Stage 3

```
U3 single-producer grep
     DB functions touching payment notifications:
       _provision_purchase_for_offerings   (calls the helper)
       mark_purchase_paid                  (the payment-side producer)
       notify_purchase_unpaid              (the helper)
     repo-side producers in api/ and src/: (none)

U3 live cycle (real data, then removed)
     create unpaid  purchase_unpaid 3 / payment_received 0
       "U3 Test Lesson Package — awaiting payment ($1,250.00)" -> /app/ops/payments/review  (x2 staff)
       "U3 Test Lesson Package — payment due"                  -> /app/orders               (buyer)
     mark paid      purchase_unpaid 0 / payment_received 3
       "Payment received — U3 Test Lesson Package ($1,250.00)" -> /app/ops/payments/review  (x2)
       "Payment received — U3 Test Lesson Package"             -> /app/orders
     purchase state paid / paid / 1250.00 / U3-TEST-REF
     cleanup        test_purchases 0 | test_notifications 0 | test_items 0
```

---

## 4. U2.6 DISPOSITION TABLE

Two-phase per instruction: the safe subset was applied, everything that would
remove or alter body text is report-only.

### 4a — APPLIED (safe subset): 6 registry rows, dead everywhere

Verified zero occurrences in any clause body, any template body, any `pg_proc`
body, and all of `src/` and `api/`.

| Token | Why removed |
|---|---|
| `PARTY.SIG_NAME` | superseded by the live `SIG.<ROLE>.<FIELD>` mechanism |
| `PARTY.SIG_DATE` | same |
| `PARTY.SIG_IP` | same |
| `PARTY.TITLE` | appears nowhere |
| `CLIENT.EUTHANASIA_INITIALS` | appears nowhere |
| `TXN.INSURANCE_REQUIREMENTS` | appears nowhere |

### 4b — REPORT-ONLY (owner decision; nothing applied)

| # | Finding | Why not applied |
|---|---|---|
| R1 | `HORSE_LEASE` v1 is **inactive, 0 documents**, but still holds 104 body tokens and 98 registry rows | retiring it deletes body text |
| R2 | `MINOR_RIDER` is **active, 0 documents**; its `GUARDIAN.*` / `EMERGENCY_CONTACT.*` tokens have never been exercised by a real render | needs a render to confirm, not a table edit |
| R3 | `HORSE.MARKINGS`, `HORSE.PASSPORT_NUMBER`, `HORSE.VET_ADDRESS`, `HORSE.VET_BUSINESS` appear in both lease bodies and resolve via `generate_document`'s HORSE branch, but have **no row in either registry mechanism** — a third, code-only resolution path | registering them is a judgement about which mechanism owns them |
| R4 | `HORSE.PASSPORT_COUNTRY`, `HORSE.REGISTRATION_ORG` — audit "offenders", but only in dead v1 | resolves itself if R1 proceeds |
| R5 | `HORSE_LEASE_V2` has **zero** `template_tokens` rows | working as designed via `contract_field_defs`; registering V2 would be a new convention, not a fix |

### 4c — KEEP (verified in use, do not remove)

`PARTY.ADDRESS`, `PARTY.DOB`, `PARTY.EMAIL`, `PARTY.FULL_NAME`, `PARTY.PHONE`,
`PARTY.PRINTED_NAME`, `PARTY.RELATIONSHIP` — role-expansion templates.
All `DOC.*`, `FHE.*`, `ORG.*`, `ENG.*` — system and config namespaces resolved in code.

---

## 5. U2.8 STAGED JSON — NOT APPLIED

Full artifact: [`docs/staged/U2_8_deductible_gating.json`](../staged/U2_8_deductible_gating.json).

Six clauses on `HORSE_LEASE_V2` currently gate only on `{X}_NOT_REQUIRED in
('NO','')`. That means "the Lessor has not certified coverage is unnecessary" —
**not** "a policy exists". So the contract can render a clause allocating
responsibility for a deductible on a policy nobody holds.

Proposed rule: add "at least one side's status is not NONE" to each gate.

| Clause | Current gate | Proposed addition |
|---|---|---|
| `INSURANCE_RISK.GL_DED_SIMPLE` | `GL_NOT_REQUIRED in (NO,'')` | `any(GL_LESSOR_STATUS ≠ NONE, GL_LESSEE_STATUS ≠ NONE)` |
| `INSURANCE_RISK.GL_DED_SPLITC` | `+ GL_DED_RESP = SPLIT` | same |
| `INSURANCE_RISK.MORT_DEDR_SIMPLE` | `MORT_NOT_REQUIRED in (NO,'')` | `any(MORT_LESSOR_STATUS ≠ NONE, MORT_LESSEE_STATUS ≠ NONE)` |
| `INSURANCE_RISK.MORT_DEDR_SPLITC` | `+ MORT_DED_RESP = SPLIT` | same |
| `INSURANCE_RISK.MED_DEDR_SIMPLE` | `MED_NOT_REQUIRED in (NO,'')` | `any(MED_LESSOR_STATUS ≠ NONE, MED_LESSEE_STATUS ≠ NONE)` |
| `INSURANCE_RISK.MED_DEDR_SPLITC` | `+ MED_DED_RESP = SPLIT` | same |

**Open question for the review thread:** the live gates use only `equals` and
`all`. If the engine has no `not_equals`/`any`, use the positive form in the
JSON's `fallback_form_if_not_equals_unsupported` (equals over
`HAS_WILL_MAINTAIN`, `WILL_OBTAIN`).

**Sequencing:** apply after U5's D1 field defs land, so both gate sets are
authored against the same field vocabulary.

---

## 6. CHANGED-CONTENT LIST (for the contract review thread)

Only this. Everything else in the templates is untouched.

### Field labels
| Template | Field key | Before | After |
|---|---|---|---|
| `HORSE_LEASE_V2` | `HORSE.AGE_DOB` | `Year foaled` | `Foaling date` |

### Field definitions
None added, none removed. `HORSE_LEASE` v1's `HORSE.AGE_DOB` label
(`Age / Date of Birth`) was **deliberately left alone** — inactive template,
0 documents, and it was never the spec's target.

### Clause bodies / template bodies
**None modified.** No clause body, template body, or heading was changed in
Stages 1–3. The two seeded U2.7 mismatches were reverted and verified at zero
residue.

### Registry rows
6 removed (§4a). No rows added.

### Rendered output that changes without any body edit
These are render-path and stored-value fixes, so a regenerated document differs
from the last extract even though no body text changed:

| Token / field | Before | After |
|---|---|---|
| `TXN.LEASE_FEE` (b7446f9e) | `⟦NEEDS:Lease fee⟧` | `Initial payment due: $850.00.` |
| `TXN.LEASE_FEE` (5dbce25f) | `Initial payment due: 0.` | `Initial payment due: $0.00.` |
| `HORSE.FAIR_MARKET_VALUE` (drafts) | `$45,000.00` from storage | `$45,000.00` from `fmt_money` |
| `TXN.EVAL_FIXED_FEE` (5dbce25f) | `100` | `$100.00` |
| `MEDICATION_DOSAGE` | empty | `5 mg` |
| `MEDICATION_INSTRUCTIONS` | empty | the schedule text |
| `MEDICATION_ADDITIONAL` | empty | supply/cost/rx when present |
| `DOC.EFFECTIVE_DATE` | today's date at render | `coalesce(effective_date, created_at)` |
| `HORSE.CURRENT_LOCATION` / `HOME_LOCATION` | `Carmel Creek Ranch` | `Carmel Creek Ranch, San Diego, CA` |

**Executed document `ecaecd42` renders identically** — its stored values were not
touched and its merged body is frozen.

---

## 7. WHAT THE STAGE 4–5 SESSION MUST KNOW

Things not in any spec file.

1. **Branch and push state.** Work is on `work/u1-lead-trust`, pushed. `main` is
   untouched at `6ddb9d0`. There is no PR yet.

2. **Migrations are applied to production already.** This repo has no
   `schema_migrations` table; migrations are a hand-maintained journal applied
   directly by `psql`. Everything in `supabase/migrations/20260802*` is **live on
   `lrstswfxfsezdmvkvukc`**. Do not re-apply.

3. **The conditional gates the owner set for Stages 4–5 still stand:**
   - **Stage 5 drops** are pre-authorized **iff** the zero-reader sweep returns
     zero for every legacy column. Paste the sweep, then apply. Any nonzero
     reader: stop, report, skip exactly the drops it blocks, apply the rest.
   - **H2** is pre-authorized **iff** H1's trace shows **both** callers carry
     authenticated sessions — then apply the simple gate. If the release flow
     fires sessionless, **stop** and show the trace plus the proposed
     server-side move before touching anything. That one is a design change on
     a live user flow.
   - **H3's real-email check** is authorized to `admin@fhequestrian.com`.
   - Curl matrices run against production `https://fhequestrian.com`.

4. **`resolve_notifications_for_link` now takes three arguments.** Signature:
   `(p_link text, p_actor uuid DEFAULT NULL, p_kind text DEFAULT NULL)`. The old
   2-arg version was **dropped**, not replaced — a defaulted third parameter
   creates an overload and makes every existing 2-arg call ambiguous. If Stage 4
   or 5 adds a parameter to any function, drop the old signature in the same
   migration.

5. **`set_contract_field` now validates money shapes** before writing. A test or
   fixture that writes `'$1,000'` to a `currency` field, or a bare amount to a
   `fee_schedule` field, will now be **rejected**. This is intended.

6. **The test suite cannot run** (D8). Do not report "tests pass" for anything
   under `test/db`. The token guard (`npm run check:tokens`) does run and is the
   only executable regression check added by this run.

7. **`docs/staged/U2_8_deductible_gating.json` must not be applied** without the
   review thread's coherence ruling.

8. **The reference sample draft is `5dbce25f`**; the executed reference is
   `ecaecd42`; `b7446f9e` is the third lease draft. `d268330c` (Charles Zigmund,
   `cjzigs@icloud.com`) is the live lessor and is **not** to be merged with its
   duplicate `07ab7dbf` outside the pre-launch cleanup.

9. **New npm scripts:** `check:tokens` (works) and `test:db` (blocked by D8).

10. **Stage 5 note found while working:** `HORSE_LEASE` v1 is inactive with 0
    documents but still carries 98 registry rows and 104 body tokens. If legacy
    retirement is in scope for that session, this is a candidate — but it
    deletes body text, so it needs an explicit owner decision (R1 above).

---

## 8. BACKLOG ENTRIES ADDED

In `docs/archive/BACKLOG.md` under a new **Pre-launch cleanup** section:

- Charles Zigmund duplicate pair (`07ab7dbf` / `d268330c`) — owner-decided merge, NOT merged now
- Two `Unnamed Contact` artifacts (`bb57e418`, `6ecceaf0`) — dispose at cleanup
- Notification NULL-link prophylactic hardening — anchor absent, hardening deliberate
- Intake deep-link — wire `IntakePage.tsx` to read `?request=<id>`
