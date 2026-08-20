# TASK-CLOSEOUT — REPORT

**Run 2026-08-19 · branch `task/closeout` (worktree `wt-closeout`) · base `origin/main` @ 60eab08.**
Commits, in phase order: `eef7dbb` (Phase 1) · `4b196d6` (Phase 2) · `4663f2b` (Phase 3) ·
this commit (Phase 4 + report). **Not pushed; the orchestrator merges.**

**Eight migrations were applied to prod** (lrstswfxfsezdmvkvukc), every one dry-run inside
`BEGIN … ROLLBACK` first **with the rollback itself proven** (function body / column /
table checked before, inside, and after):

| migration | what |
|---|---|
| `20260819T0100_closeout_11_one_gate_before_every_signature` | §1.1+1.2 |
| `20260819T0110_closeout_13_already_activated_reads_as_sign_in` | §1.3 |
| `20260819T0120_closeout_15_horse_docs_wait_for_execution` | §1.5 |
| `20260819T0130_closeout_16_skip_a_required_document` | §1.6 |
| `20260819T0140_closeout_17_the_contract_envelope_follows_its_document` | §1.7 |
| `20260819T0150_closeout_18_the_notification_log_is_the_source_of_truth` | §1.8 |
| `20260819T0200_closeout_22_mint_comment_tells_the_truth` | §2.2 |
| `20260819T0210_closeout_34_experience_enforced_where_it_cannot_be_bypassed` | §3.4 |

**Walk evidence committed:** `TASK-CLOSEOUT-walk1.sql` + output (§1.1/1.2),
`TASK-CLOSEOUT-walk16.sql` + output (§1.6), `TASK-CLOSEOUT-walk21.sql` + output (§2.1).
The smaller dry-run walks (§1.3, §1.5, §1.7, §1.8, §3.4) are quoted below.
Every DB claim in this report is query output; **every render claim is NOT VERIFIED**
and lives as a numbered step in `RETEST-CHECKLIST.md`.

---

# PHASE 1 — THE LEASE FLOW

## §1.1 + §1.2 (A3 + A2) — one gate, before every signature ✅ FIXED + PROVEN

**Verified live before fixing** (walk1 P0, same document, same moment):

```
on_screen_blockers: []                      ← contract_lock_blockers (what the UI shows)
naive_required_empty: 17  of_which_conditional: 17
OLD GATE: ERROR: cannot sign: 17 required field(s) still empty
```

The screen said clean; the gate refused — all 17 are conditionals the UI correctly hides.
And per CONTRACTWALK, a LOCKED document skipped every gate entirely.

**The fix:** `lock_and_sign_contract` deletes its own checks and asks
`contract_lock_blockers` — one function decides completeness — and the gate now runs
before **every** signature, whatever the state. `executed` is dropped from the accepted
states: `remove_my_signature` regresses a withdrawn document to `editable`, so no
legitimate signature ever arrives in `executed` (D14 supersession is the real
change path).

**Regression sweep, as required — every existing document, old count vs new blockers:**
all **51** live documents (all `executed`) returned `old_gate4_missing = 0` and
`blocker_count = 0`. **Zero documents would newly block.**

**Proven after applying (walk1, one lease with 17 conditionals):**

```
P2  NEW gate, clean screen, editable:  signed_from_editable = AWAITING_SIGNATURE   ← A3 closed
P3  blank TXN.LEASE_START on the LOCKED doc + unconfirm horse, sign:
    ERROR: cannot sign: Required field(s) still empty: Lease start date;
           The horse information has not been confirmed by the Lessor              ← A2 closed
P4  real path: lessee AWAITING_SIGNATURE → lessor EXECUTED, execution hash set
P5  further signature on the executed doc:
    ERROR: document is already executed; changing it requires signatures to be removed first
P6  after ROLLBACK: old body restored; documents 51, signatures 51, pg_net queue 0
```

## §1.3 (A4) — "you've already activated — sign in" ✅ FIXED + PROVEN

One branch in `invitation_replacement_notice`: token's invitation is `redeemed` **and** a
profile exists for that email **and** no newer live invitation exists →
`{"already_activated": true}`; `/activate` renders *"You've already activated this
account — this link has done its job. Sign in below…"* over the Sign In button it
already had. Everything else keeps today's behaviour — proven on all five cases:

```
CASE 1 redeemed + profile, no newer     → {"already_activated": true}
CASE 2 newer live invitation exists     → masked resend notice (precedence unchanged)
CASE 3 redeemed, NO profile             → NULL
CASE 4 unknown token                    → NULL
CASE 5 still-live token                 → NULL
```

## §1.4 (A5, owner-ruled "Evergreen yes") — presentation, not validation ✅ FIXED (render steps on the checklist)

- NULL lease end now reads **"Leased — evergreen"** (StableSection),
  **"— evergreen (until terminated)"** (HorsePage, both viewer directions, both cards),
  **"· evergreen — until terminated"** / **"Leased → until terminated"**
  (HorseRecordsPage row + collapsed line). Never blank, never "—".
- The staff lease-end editor says **"Leave the end date empty for an evergreen lease."**
- `HorseIntakeForm` **no longer requires** the lease end date when a horse is marked
  leased — a pre-existing required-field rule that contradicted the ruling; lessee name
  and lease start stay required.
- No warning, no default end date was added.

**Termination reachability, established and reported:** a party or staff requests from
ContractPage → Manage → Terminate; the counterparty approves (`request/approve/
decline_contract_termination`, all live in prod); `approve_contract_termination` sets
`workflow_state='terminated'`, resolves the request notifications, notifies all parties.
**Reachable.** ⚠️ **Gap found, reported, not fixed here:** termination updates the
DOCUMENT only — nothing clears `horses.lessee_contact_id` / ends the active
`horse_relationships` LESSEE row, so a terminated (especially evergreen) lease leaves
the horse reading "Leased" until staff clear it manually on Horse Records (which they
can — the manual editor exists). Recommended follow-up: fold the horse release into
`approve_contract_termination` for lease documents.

## §1.5 (B2, owner-ruled) — horse documents wait for execution ✅ FIXED + PROVEN

The lock-time `ensure_horse_documents` call in `advance_document_workflow` is deleted;
the execution-time call in `apply_contract_execution_effects` is untouched. Dependency
check came back clean before the change: `contact_document_wall_state` reads only
`contact_required_documents` (which `ensure_horse_documents` never writes), and
`sign_sequence` has no UI consumer — nothing assumed the documents existed at lock.

**Both counts, before and after, one lease taken to EXECUTED (walk15):**

```
BEFORE the fix   owner's horse docs after LOCK:   HORSE_EMERGENCY_VET 1 · RELEASE_HORSE_CARE 1
AFTER the fix    owner's horse docs after LOCK:   (empty — 0 rows)
                 …lease signs, EXECUTED…
                 owner's horse docs after EXECUTION: HORSE_EMERGENCY_VET 1 · RELEASE_HORSE_CARE 1
                 (both AWAITING_SIGNATURE)
```

## §1.6 (owner-ruled) — remove at provisioning, skip afterwards ✅ BUILT + PROVEN

**Remove already existed twice and was verified, not rebuilt:** the provisioning form's
per-document checkboxes send an explicit `template_keys` override, and walk16 E1 proves
a Horse-owner lessor provisioned with the two horse documents unchecked gets
**requirement rows for the other three only — the horse docs are never created**. (The
PaperworkEditor's uncheck-and-save is the post-provisioning removal.)

**Skip is the build** (`skipped_at / skipped_by / skip_reason` on
`contact_required_documents`, honored everywhere that reads the table):

```
lock the lease with an over-assigned Lessor (full 5-doc Horse-owner set):
  ERROR: cannot lock: Onboarding documents must be completed first by: Sixteen Lessor
skip all 5 (reason recorded) →
  lessor wall: {"gating": 0, "pending": 0}          ← the WALL is clear
  lease blockers: []                                 ← the LOCK GATE is clear
  lock → locked; lessee signs; lessor signs → EXECUTED
a skip never reads as signed:
  all 5 rows: satisfied = f · skipped = t · has_reason = t
  lessor documents created by skipping: 0
  my_onboarding_state (as the lessor): needed = f, documents listed = 0
  generate_my_onboarding_documents: generates nothing
the audit: 5 audit_logs rows, event=requirement_skipped, by staff, reason recorded
the guard: skip on the lessee's signed RELEASE_GENERAL →
  ERROR: this requirement is satisfied by an executed document and cannot be skipped
restores: unskip → wall gating back to 1 · staff re-assign clears the skip ·
  the editor's replace-save PRESERVES surviving skip marks (3 of 5 kept)
```

UI: the PaperworkEditor now renders per-row **Skip** (with a reason prompt, D19) and
**Restore**, with who/when/why on the row. New RPCs `skip_required_document` /
`unskip_required_document` / `contact_required_documents_state` are staff-gated.
`apply_category_documents` interaction checked: `ON CONFLICT DO NOTHING` keeps an
existing skipped row's marks; the walk proves no client's requirements were stripped.

## §1.7 (B3) — the trigger is real now ✅ FIXED + PROVEN

Verified first: prod has **0 `deals` rows and 0 `contracts` rows**; `create_deal`
(DealsPage) is the **only** deals writer; `start_lease_contract_v2` creates a contracts
row and never a deal — so for every New-Contract lease the trigger no-oped and
`contracts.status` stayed `draft` beside an EXECUTED document, forever.

**Not retired** — it is the completing half of the reachable DealsPage flow. The missing
half was added: on execution of the GOVERNING document (same template predicate as
`apply_contract_execution_effects`, so the two attachment documents can never trigger
it), the contract envelope advances. Deal completion keeps its own stricter rules.

```
after start_lease_contract_v2:  contracts.status = draft · deals rows = 0
after ONE signature:            still draft
after BOTH signatures:          contract_status = executed · signed_at set
                                beside document EXECUTED/executed
```

## §1.8 (B5, owner-ruled) — the notification log is the source of truth ✅ BUILT + PROVEN

One permanent `notification_log` for ALL notifications — matching the shape of the four
existing send logs — written **before the delete, in the same transaction**, by both
deleters (`consume_notification`, `resolve_notifications_for_link`). Every owner-ruled
field is a column: kind/category · title/body/link · **author** · **reason** ·
recipient (per-row; one notification event fans to several recipients = several rows) ·
raised_at · emailed_at/read_at · **locations** · **outcome + outcome_at + outcome_by**.

- **Author and category were never captured anywhere** — a `BEFORE INSERT` trigger now
  stamps both on `notifications` itself (category derived from kind; author =
  `auth.uid()`, NULL reads as "system"), covering all **28** notifier call sites without
  rewriting them. All 46 live rows backfilled (`live 46 · categorized 46`).
- `reason` is a real column notifiers can now fill; the log carries title/body meanwhile.
- RLS: staff-only SELECT; **no insert/update/delete policies — the log has no delete
  path and is never swept.**
- **Read back as part of the contract's document set** (the ruling's operative clause):
  `contract_notification_log(document_id)` filters the ONE log by link (both link
  shapes), rendered in the staff **Activity** card on ContractPage as
  *"Notification log · N resolved"*.
- `purge_account` / `hard_delete_contract` keep their wholesale deletes deliberately:
  purge is the owner-run test-identity removal where a retained log would defeat the
  purge; hard delete is for never-sent documents. Both are destruction, not resolution.

```
consume:  notification gone · log row: kind contract_locked · category contract ·
          author staff · recipient co18-member@… · locations {in_app} ·
          outcome dismissed_by_recipient · outcome_by = the recipient
resolve:  resolved_count = 3 (the admin mirror trigger fanned party_signed to both
          co-owner inboxes — all three logged) · emailed row carries {in_app,email}
contract view: 4 rows, authors and recipients named, in raised order
RLS: member sees 0 rows; the staff-gated reader answers them 0 rows
```

---

# PHASE 2 — THE CARE PLANS

## §2.1 — the generator DID catch up; the agreement is now proven ✅ ALREADY CLOSED + PROVEN

Verify-before-fixing: the finding ("`generate_monthly_lessons` has ZERO references to
`recurring_days`") was true when written and **closed by the CAREPLANS m3 merge** — the
generator now delegates to `_generate_plan_month`, which reads
`config->'recurring_days'` (singular kept as a read fallback) and **spends one allotment
credit per generated session from the plan's own line**. No code change was needed; the
required proof ran on a deliberately mismatched plan (three days on a 2x SKU,
surfaced-not-blocked per the owner's rule):

```
set_recurring_days(Tue,Thu,Sat, indefinite): entitled_this_month = 5 · quantity 3 ·
                                             differs_from_catalog = true
lesson_credits:            credits_total 5 · credits_remaining 5
independent day count:     5   (Tue/Thu/Sat occurrences, today → month end)
generate_monthly_lessons:  created 5 · skipped_no_entitlement 0

THE AGREEMENT:   entitlement_counted 5 == bookings_generated 5 · credits_left_after 0
placement:       Sat 2 · Thu 2 · Tue 1   (chosen days only)
funding:         bookings 5 · with_credit 5   (each carries the credit it spent)
```

Bonus gate proven by the walk's own first run: a **draft** order mints nothing and
generates nothing (`skipped_no_entitlement = 5`) — a real checkout opens the order first.

## §2.2 (CREDITALIGN F1) — already closed by an owner ruling; the stale comment was the defect ✅

The task doc asks owner question 2 ("does a single care service mint a credit?") —
**it was already answered on 2026-08-16**: migration `20260816T2900` quotes the owner —
*"any of the services that have a single quantity need to mint a credit with the service
attached to it"* — and removed the horse-segment mint gate. Verified live:

```
probe: Full Body Clip purchase (awaiting_payment) → credits_minted 1 · total 1
catalog: all six one-off horse services carry unit_count 1
```

What remained was a **D20 stale-claim trap**: the live mint body still SAID *"a
HORSE-segment scheduled SKU mints nothing (FLOWTRACE F2)"* beside code that mints — the
exact comment that sent this task hunting a fixed defect. `20260819T0200` re-trues the
comment (same in-place string-replace mechanism as 20260816T2900, guards intact).

---

# PHASE 3 — THE FUNNEL LEFTOVERS

- **§3.1 ✅** `BookSupport` rebuilt to the fixed `BookHorse` shape: derived step count,
  the third step IS the submission (summary → Continue Shopping → the one form →
  `InquiryForm` → `/confirmation`), the `/checkout` fourth screen is gone, "Previous"
  reads "Back". Render steps: checklist 5.
- **§3.2 ✅ (D13)** the turnout section heading now reads the OFFERING's own catalog
  name off the cart item (display only — the slug stays the identifier); renaming the
  SKU in the catalog editor renames the heading. Checklist 7.
- **§3.3 ⚠️ REPORT + OWNER QUESTION** — verified still true: a mixed cart is filed under
  the funnel the visitor stood in (`InquiryForm.tsx` chooses from `state.funnel`;
  `requests_category_check` allows `general/lessons/horse_care/acquisition/media/
  partnership/gift` — **no `mixed`**). Live rows: `general 9 · lessons 6`. Not fixable
  without the owner defining what a mixed inquiry IS — see owner questions.
- **§3.4 ✅** riding experience enforced server-side in `submit_public_request` — the
  SAME `intake_requirements` row the form reads (booking·experience·required) gates the
  RPC, before any write. Proven: refusal writes nothing (`requests 15 → 15`); with
  experience → accepted; horse-care control unaffected; flipping the config off releases
  both ends. Dry-run + rollback proven, applied.
- **§3.5 ✅** `AgreedLessonSection` (self-contained: SessionFields state, horse roster,
  instructor fallback) now rides on **all** provisioning surfaces — New client page,
  contact dossier, Admin invite panel — so a phone-agreed lesson folds into the one
  provisioning act everywhere, not only the lead drawer. The RPC side
  (`provision_client_invitation.p_agreed_lesson`) already handled it. Checklist 13.
- **§3.6 ✅** `/book/rider` → `<Navigate to="/lessons" replace>`; the page file stays
  (redirect, not delete). Checklist 9.
- **§3.7 ✅ REPORT ONLY** — there are **nine** `INTAKE_HORSE_*` rows, not five
  (CLIPPING, EVALUATION, EXERCISE, FINDER, LEASE_IN, LEASE_OUT, PURCHASE, SALE,
  TRAINING — all `active=true`, all created 2026-07-02). **No end-user surface renders
  any of them**: no DB function references those form keys (the earlier "two functions
  reference them" turned out to be the SQL `_` wildcard matching `intake?horse=` links —
  a lesson in LIKE hygiene), and the only frontend readers of `form_definitions` are the
  admin form editor (lists them for editing) and the booking-forms instance layer (other
  keys). Not wired up, per the instruction.

---

# PHASE 4 — THE RETEST

**`docs/reports/RETEST-CHECKLIST.md`** replaces **seven** stacked checklists —
ASKRIGHT §7 (16 steps, added by the owner's addendum), CAREPATH, LESSONREQUEST,
GIFTPATH, SESSIONBOOK, PARTYROLE, FOOTER — with **40 steps** in the order a real person
moves (emails → visitor → staff → activation → lease → execution → visual once-overs),
**the four email proofs lead**, every step naming what to click and what should happen,
each marked **[FIX]** (proves a fix; names it) or **[CONFIRM]** (existing behaviour
never eyeballed).

**ASKRIGHT §7's dedupe, specifically** — its 16 steps became 12 new ones (8–17 as the
questions-engine run, plus the wording sweep at 40) because four of them already had a
home in the walk and were merged rather than repeated:

| ASKRIGHT §7 | disposition |
|---|---|
| 1–3 (one clip, the right 8 questions, conditional reveal, own/lease collapse) | new step 8 |
| 4 (shared questions asked once) | new step 9 |
| 5 (à la carte vs weekly exercise) | new step 10 |
| 6 (Horse Finder set) | new step 11 — **and its second half** (the *"Noted for our conversation"* panel is gone) folded into step 5, which already opens `/acquisition` |
| 7 (budget/age band wording) | new step 11 |
| 8 (Finder + Evaluation share experience) | new step 12 |
| 9 (cross-entry: horse cart → /lessons → questions) | new step 13 |
| 10 (lessons alone skip the questions page) | new step 14 |
| 11–12 (inference fills, announces, yields) | new step 15 |
| 13 (the leased horse carries over) | new step 16 |
| 14 (checkout's lesson-only fields come and go) | **merged into step 17**, which already covered LESSONREQUEST 1/G3's availability gate on the same screen |
| 15 (lead Details list + the alert email renders it) | **split and merged**: the email half into step 1 (the email section leads), the lead-page half into step 20, which already opened that page |
| 16 (wording sweep, nav unchanged) | new step 40 |

The empty-cart precondition ASKRIGHT §7 opens with is now a standing note in the
checklist header rather than a per-step repetition.

---

# THE TEST THIS MUST PASS — answered

1. **Every phase-1 item fixed or deferred with a reason** ✅ — all eight fixed; the one
   deferral inside §1.4 (termination doesn't release the horse) is reported with its
   reason (the task scoped termination to establish-and-report) and a recommended
   follow-up. The lease flow runs end to end server-side — walk16 runs provision →
   redeem → lease → wall → lock-blocked → skip → lock → sign → sign → EXECUTED in one
   transaction against prod.
2. **A locked document cannot be altered and then signed** ✅ — walk1 P3 replays the
   CONTRACTWALK attack against the new gate: refused, naming the blanked field and the
   unconfirmed horse.
3. **`contract_lock_blockers` and the sign gate agree on a document with conditionals**
   ✅ — walk1 P0/P2: 17 hidden conditionals; blockers `[]`; the gate now signs.
4. **Remove at provisioning AND skip afterwards; skip clears wall + lock gate, never
   reads as signed** ✅ — walk16 E1 + E2, quoted above.
5. **Bookings generated == entitlement counted, both numbers shown** ✅ — walk21: 5 == 5,
   zero credits left, multi-day placement shown.
6. **`deal_autocomplete_on_execution` does something real** ✅ — the envelope follows its
   governing document (draft → executed proven); the deal half stays for DealsPage.
7. **`/book/rider` redirects** ✅ (code + route; render step on the checklist).
8. **`RETEST-CHECKLIST.md`** ✅ — exists, journey-ordered, deduplicated, emails first;
   40 steps absorbing **seven** source checklists (ASKRIGHT §7 added by the owner's
   addendum, its 16 steps deduped to 12 — see the table in Phase 4).
9. **Every DB claim is query output; render claims NOT VERIFIED** ✅ — throughout, and
   the checklist carries every render claim.

---

# NEW FINDINGS (not in any prior report)

- **F-NEW-1 ⚠️ `record_signature` is granted to `anon` and `authenticated`.** Any party
  (or anonymous caller shaped like one) can invoke it directly via PostgREST and bypass
  every gate `lock_and_sign_contract` now enforces — same defect class as A2, one door
  left. It is not casually closable: the anon grant almost certainly serves the kiosk
  wall-doc signing flow (RELEASE_GENERAL at visit) and the onboarding path calls it
  directly. Needs a deliberate spec: split a gated public entry from an internal
  signer, or teach `record_signature` to run the blockers itself for contract-engine
  documents. **Flagged, not changed.**
- **F-NEW-2 ⚠️ terminating a lease never releases the horse** (detail under §1.4).
- **F-NEW-3** the CLAUDE.md lint baseline note ("~26 warnings") is stale — main is at
  **46 warnings** (verified by running lint on main); this branch is identical.
- **F-NEW-4** `TASK-CLOSEOUT`'s own §3.7 count was stale: nine `INTAKE_HORSE_*` rows,
  not five.

# OWNER QUESTIONS

1. ~~§1.4 end date~~ — **already ruled** ("Evergreen yes"), built as presentation.
2. ~~§2.2 single care service~~ — **already ruled 2026-08-16** (mints one
   offering-tagged credit; live and proven).
3. **§3.3 — what IS a mixed inquiry, for filing and filtering?** Still open, still
   needed before the category model can be fixed. Options the data supports: (a) add a
   `mixed` category value; (b) file one request per category with a shared thread id;
   (c) keep one request and derive filter membership from its ORDER LINES instead of
   the single category column (no schema change to requests; staff filters read the
   selections). Recommendation: **(c)** — the order lines already know what's in the
   inquiry, and a derived filter cannot under-count.
4. **(new, from F-NEW-1)** may `record_signature` stop accepting direct anonymous calls
   for contract-engine documents, provided the kiosk release flow keeps its own door?

# TEST SUITE — file-for-file diff against main

Per the trap ("not a green baseline — diff file-for-file"), `vitest run test/db`
(`--maxWorkers=2`, the 8GB-machine cap) ran on BOTH trees on 2026-08-19:

```
main (60eab08):        passed 26 · failed 46 · of 72 files
task/closeout:         passed 26 · failed 46 · of 72 files
identical files:       72 of 72 — NO PER-FILE DIFFERENCES
```

The 46 red files are the pre-existing baseline (recorded by CREDITALIGN), byte-for-byte
the same set on both trees — **this branch introduces zero new test failures.**
`npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 46 warnings, identical count
to main (run on both).

# TEARDOWN

Process census at start and end of session: no orphan node/vitest/esbuild processes;
the two `vitest run` invocations below exited before this commit; `wt-closeout` keeps a
symlinked `node_modules` (no duplicate install). Scratch SQL probes lived under the
session scratchpad, not the repo; the three committed walks + outputs are deliberate
evidence, per CONTRACTWALK precedent.
