# TASK CLOSEOUT — fix everything the walk-throughs found, then prove it

**RUN WITH: Opus 5 · thinking ON · effort HIGH.**

⚠️ **THIS IS LARGE. Work the phases IN ORDER and commit after each.** If context runs short, stop at
a phase boundary and report honestly — a half-finished phase 1 is worth more than four phases begun.
**Phase 1 is the lease flow, which is what the owner is waiting on.**

**HOW TO RUN:** everything is in this file · **verify every finding still exists before fixing it —
several were closed by later merges** · migrations dry-run with the rollback proven · report to
`docs/reports/TASK-CLOSEOUT-REPORT.md` · commit, **do not push** · no subagents · every DB claim is
query output, render claims **NOT VERIFIED**.

---

# WHY THIS EXISTS
Six threads and two walk-throughs have run since 2026-08-16. Each fixed what it was sent for and
**reported what it found but deliberately did not touch.** Those leftovers are now collected here.

**Sources:** `TASK-CONTRACTWALK-REPORT.md` (A1–A5, B1–B5) · `TASK-CAREPATH-REPORT.md` (G1–G5) ·
`TASK-LESSONREQUEST-REPORT.md` (G1–G5) · `TASK-CAREPLANS-REPORT.md` · `TASK-PARTYROLE-REPORT.md` ·
`TASK-SESSIONBOOK-REPORT.md`.

⚠️ **ALREADY FIXED — do not redo, but VERIFY each is still closed:**
- **A1** (Deal client got three documents; admin could not narrow) — `PARTYROLE` fixed both halves.
- **CAREPATH G1** (weekly ×2 limited to one weekday) — `CAREPLANS` replaced the entitlement maths.
  ⚠️ **But see §P2.1 — the BOOKING half looks unfinished.**

---

# PHASE 1 — THE LEASE FLOW (do this first; it is what the owner is waiting on)

## 1.1 — `lock_and_sign_contract` skips its own gates exactly when they matter  ⟵ **the worst one**
`CONTRACTWALK` A3, verified by the orchestrator:
```
IF v_state NOT IN ('locked','editable','executed') THEN … END IF;
IF v_state IN ('editable') THEN   ← gates 3,4,5,6 live ONLY in here
```
**The UI only shows the sign button when the document is `locked`.** So in practice **none of those
gates ever run at signing.** Proven: a locked document with a required field blanked and the horse
unconfirmed **signed anyway**.

- **Real enforcement is at `advance_document_workflow(…,'locked')`.** That is defensible — check
  once, then freeze — **but only if a locked document cannot then be altered.**
- **Decide and implement one of:** re-run the gates at signature time regardless of state, **or**
  make `locked` genuinely immutable so the earlier check still holds. **State which and why.**
- ⚠️ **`executed` is also accepted by the state check.** Establish whether an executed document can
  receive another signature, and if so, close it.

## 1.2 — two completeness checks disagree (A2)
`contract_lock_blockers` is condition-aware; **gate 4 is a naive `count(*)` of `required` fields.**
Result: a screen showing no blockers, and a sign attempt refusing with
`cannot sign: 17 required field(s) still empty` — **all 17 conditionals the UI hides and nobody can
fill.** The report lists all 31 fields, split 15 always-active / 16 conditional.
**Make the two agree. `contract_lock_blockers` is the correct one — gate 4 must use the same rule.**

## 1.3 — three dead ends, one identical message (A4)
Three distinct failures produce the same text, so staff cannot tell which they hit.
**Give each its own message naming the actual cause and the actual next step.**

## 1.4 — a lease with no end date is LEGITIMATE (A5) — ✅ **owner-ruled: "Evergreen yes"**
`TXN.LEASE_END` stays optional. An open-ended lease runs **until terminated**, and
`horses.lease_end = NULL` is a correct, permanent state — **not a defect to close.**

**So the work here is presentation, not validation:**
- **A NULL end date must read as "Evergreen" or "until terminated" wherever a lease is shown** —
  never as blank, never as "—", and never as an error. A staff member seeing an empty end date
  should know it is deliberate.
- ⚠️ **Do NOT add a required-field rule, a warning, or a default end date.**
- **Termination must be reachable** — an evergreen lease needs a way to end. Establish what ends one
  today (`workflow_state = 'terminated'` exists) and **report whether staff can actually reach it.**

## 1.5 — the horse documents are created TOO EARLY (B2) — ✅ **owner-ruled, 2026-08-18**

**Owner:**
> *"they should be surfaced first in the onboarding flow in theory, but a party looking at a contract
> they might not sign doesn't need to complete documents that might not be needed."*

**Measured — `ensure_horse_documents` is called from BOTH:**

| caller | when | verdict |
|---|---|---|
| `advance_document_workflow` (line ~143, `is_horse_lease_template` branch, `p_include_care = true`) | **at LOCK — before anyone signs** | ⚠️ **WRONG. Remove this call.** |
| `apply_contract_execution_effects` | **at EXECUTION — after both parties sign** | ✅ **correct. Keep it.** |

**The lock-time call manufactures paperwork for a person who is still deciding.** If they decline the
lease, those documents were never needed — and they were created in their name regardless.

**THE FIX: delete the lock-time call. Keep the execution-time one.**
- A party reviews the lease with **nothing else attached**.
- They sign. Execution creates `HORSE_EMERGENCY_VET` + `RELEASE_HORSE_CARE` — **because only now is
  the horse genuinely coming into your care.**
- **This resolves B2 outright** rather than merely surfacing it: the right fix is not to announce the
  documents earlier, it is **not to create them yet.**

⚠️ **Prove the execution path still creates them** — removing the wrong call must not remove the
right one. **Both counts, before and after, on a lease taken to EXECUTED.**
⚠️ **Check nothing depends on them existing at lock time** — if a lock-time reader assumes they are
there, it must be found now rather than by a lessor later.

**See §1.6 for the escapes the owner wants once they ARE created.**

## 1.6 — the Lessor's documents: default ON, skippable, removable  ⟵ **OWNER RULING, 2026-08-17**
> *"the lessor is categorized as horse owner and by default they should be assigned the documents,
> but they can be skipped or removed outright (skipping is a fallback in case removal is overlooked
> on provisioning)."*

**This answers `PARTYROLE` owner question 2. The documents are CORRECT** — a lessor is a horse owner
and is handing you their horse to care for. **Build TWO escapes, not one:**

| | when | what it does |
|---|---|---|
| **remove** | at provisioning | the requirement is never created |
| **skip** | any time after | an existing requirement stops blocking — **the fallback for when removal was overlooked** |

⚠️ **Skip must clear the WALL and the LOCK GATE**, or it is decorative — the whole point is
unblocking a lease whose paperwork was over-assigned.
⚠️ **Skipping is not signing.** A skipped document must never read as executed, and **the audit must
show who skipped it and when.**
⚠️ **Never skip or remove an EXECUTED document** — standing rule, 2026-07-29.

## 1.7 — `deal_autocomplete_on_execution` is dead for every lease (B3)
It fires on execution and does nothing, because **New Contract never creates a `deals` row** — prod
has zero. So `contracts.status` stays `draft` beside an `EXECUTED` document.
**Either create the deal row where a deal genuinely exists, or retire the trigger.** ⚠️ **Do not
leave a third dead notifier in this codebase** — this is the same shape as `INBOUNDALERT`,
`GIFTPATH` and `schedule_lesson_session`.

## 1.8 — notification resolution is a DELETE with no log (B5) — ✅ **owner-ruled**

**Owner, 2026-08-18:**
> *"Deleting a notification is only acceptable if the log for them is part of the contract docs set.
> At minimum this should include (notification name/type/category, created timestamp, author, reason,
> notified timestamp, recipients, locations, outcome, outcome timestamp) when resolved. The log is
> our source of truth."*

**And on what else one might do with a resolved notification: nothing.** It is a delivery artifact,
not a record. **Deleting stays correct — writing the log first is what is missing.**

**Measured:** `notifications` is `id · org_id · user_id · kind · title · body · link · read_at ·
created_at · emailed_at`. **No status, no reason, no recipients, no outcome.** `audit_logs` cannot
serve — it is a generic row-change audit (`old_value`/`new_value`), recording that a row vanished,
not why it existed.

**Build a notification log with the owner's fields, at minimum:**

| field | notes |
|---|---|
| name / type / category | `kind` exists; **the category is new** |
| created timestamp | `created_at` |
| **author** | who or what raised it — ⚠️ **not currently captured at all** |
| **reason** | why it was raised — ⚠️ **not captured** |
| notified timestamp | `emailed_at` covers email; **in-app delivery is not timestamped** |
| **recipients** | plural — one notification can reach several people |
| **locations** | where it surfaced (dashboard, email, contract page) |
| **outcome + outcome timestamp** | what resolved it, and when |

- ⚠️ **Write the log BEFORE the delete, in the same transaction.** A log written after a delete that
  fails is the bug this section exists to prevent.
- **Follow the existing pattern, do not invent a new one.** `document_deliveries`,
  `request_alert_sends`, `receipt_sends` and `signup_alert_sends` are four purpose-built send logs
  already in this schema — **match their shape.**
- **The log is the source of truth** — the owner's words. It outlives the notification and is never
  swept.
- ⚠️ **Contract-related entries must be readable AS PART OF THE CONTRACT'S DOCUMENT SET**, per the
  ruling. **Build ONE log for all notifications and let the contract view filter to that contract**
  — a contract-only log would leave lesson, payment and lead alerts unrecorded and need a second
  mechanism later.

---

# PHASE 2 — THE CARE PLANS

## 2.1 — ⚠️ THE BOOKING GENERATOR DID NOT KEEP UP WITH THE ENTITLEMENT
**Found by the orchestrator, 2026-08-18. Not in any report.**
`CAREPLANS` added `set_recurring_days(p_days text[], p_weeks, p_indefinite)`, which computes the
month's entitlement via `_recurring_allotment_days` and writes `lesson_credits.credits_total`.

**But `generate_monthly_lessons` — the only booking generator, still called from
`src/lib/ops/api-calendar.ts:637` — has ZERO references to `recurring_days`.** It still books a
single weekday.

**So the entitlement says 9 and the generator produces 4 or 5.** The owner's model — *"the month
starts with applied bookings auto generated"* — is only half delivered.
**Verify this is still true, then make generation follow the same days the entitlement counts.**
⚠️ **Bookings and entitlement must agree; prove both counts on one plan.**

## 2.2 — à la carte care mints nothing (CREDITALIGN F1, still open)
**A one-off horse-care service mints no entitlement, so à la carte care does not work** — half the
shape `CAREPLANS` is named after.
⚠️ **OWNER RULING NEEDED:** a single Clip or Exercise Session — does it mint one credit like a
single lesson, or is it purely a scheduled visit with no credit at all? **Ask, then build.**

---

# PHASE 3 — THE FUNNEL LEFTOVERS

- **3.1 (CAREPATH G4)** — `BookSupport.tsx` still carries the step-tracker defect CAREPATH fixed in
  `BookHorse.tsx`. **Same fix, acquisition lane.**
- **3.2 (CAREPATH G5)** — the "Turnout" section heading is hardcoded, not catalog-driven (D13).
- **3.3 (CAREPATH G3 / ASKRIGHT F8)** — `requests.category` is decided by whichever funnel the
  visitor stood in, so **a mixed order is filed under one category and staff filters under-count**.
  ⚠️ **Needs a decision about what a mixed inquiry IS before it can be fixed — report, then ask.**
- **3.4 (LESSONREQUEST G2)** — riding experience is enforced **client-side only**. Enforce it where
  it cannot be bypassed, or stop calling it required.
- **3.5 (LESSONREQUEST G4)** — the agreed-time panel exists on the **lead path only**, so a lesson
  inquiry that arrives another way cannot be scheduled the same way.
- **3.6** — **retire `/book/rider`** behind a redirect (orphaned; contradicts the no-questions-page
  ruling). **Redirect, do not delete.**
- **3.7** — report on the five `INTAKE_HORSE_*` `form_definitions` rows that **no surface renders**.
  **Report only — do not wire them up.**

---

# PHASE 4 — THE RETEST  ⟵ **the deliverable the owner actually asked for**

**Six separate browser checklists are now stacked** across the CAREPATH, LESSONREQUEST, GIFTPATH,
SESSIONBOOK, PARTYROLE and FOOTER reports — roughly fifty steps, overlapping, in report order rather
than in the order a person would actually do them.

**Replace them with ONE ordered walk**, `docs/reports/RETEST-CHECKLIST.md`:
- **In the order a real person moves** — visitor → inquiry → staff → activation → lease → execution.
- **Every step names what to click and what should happen**, in plain language.
- **Deduplicated** — a thing proven once is not re-listed.
- **Marked where it proves a FIX from this task** versus confirming existing behaviour.
- ⚠️ **The email steps lead.** Nothing in six threads has proven a real send, and three separate
  reports each nominate their email step as the first thing to run. **Put them at the top.**

⚠️ **Everything provable server-side must already be proven in the report** — the checklist is for
what genuinely needs a browser and a session, nothing more.

---

# TRAPS
- **Verify before fixing.** Several findings are already closed; a "fix" for a fixed thing is a
  regression risk for no gain.
- **`apply_category_documents` DELETES requirements outside the wanted set** — the mechanism that
  destroyed a boarder's paperwork in `PARTYROLE`. **Anything touching requirements must prove it
  does not strip an existing client.**
- **Executed documents are never swept, skipped or removed** (2026-07-29).
- **Do not build a second booking writer, notifier or credit path.** Four dead ones already exist.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- `assertWrote()` on every write; **RLS silently zeroes UPDATEs.**
- **Run the PGlite suite** — **not a green baseline (46 red files); diff file-for-file against `main`.**

# THE TEST THIS MUST PASS
1. Every phase-1 item is fixed or explicitly deferred **with a reason**, and the lease flow runs
   end to end server-side.
2. **A locked document cannot be altered and then signed** — prove the hole is closed.
3. `contract_lock_blockers` and the sign gate **agree**, on a document with conditional fields.
4. **The Lessor's documents can be removed at provisioning AND skipped afterwards**, and a skip
   clears both the wall and the lock gate without ever reading as signed.
5. **Bookings generated == entitlement counted**, on one multi-day plan. Both numbers shown.
6. `deal_autocomplete_on_execution` either does something real or is gone.
7. `/book/rider` redirects.
8. `RETEST-CHECKLIST.md` exists, is ordered by human journey, is deduplicated, and **leads with the
   email steps.**
9. Every DB claim is query output; render claims **NOT VERIFIED**.

# OWNER QUESTIONS — ask before building the parts they gate
1. **§1.4** — may a lease execute with **no end date**, or is an end date mandatory?
2. **§2.2** — does a **single** care service (one Clip, one Exercise Session) mint a credit, or is it
   a scheduled visit with no credit?
3. **§3.3** — what IS a mixed inquiry, for filing and filtering?

Report to `docs/reports/TASK-CLOSEOUT-REPORT.md`. Do not push; the orchestrator merges.
