# TASK-SIGNBOOK — running ledger

**Thread:** `TASK-SIGNBOOK` · opened 2026-09-01 · worktree `wt-1`, branch `task/signbook` from
`origin/main` @ `6ffbd0df`.
**Spec:** `docs/tasks/TASK-SIGNBOOK-the-wizard-ends-in-a-booking-request-not-a-payment.md`
(+ ORCH6's required-reading addendum).

## RESUME — read this first
- **State:** orientation. CLNR pass run. Worktree cut. Premises being re-measured.
- **Next:** verify the step machine, the `requested` status question, then the blocker walk.

## LOG
### 1 · CLNR pass (zeroth act)
- `docs/` root: 0 loose files. Folders: the eight of §2a plus `contract-content`, `contract-exports`,
  `proposed`, `staged`, `ui-orders` — all pre-existing and left in place by `CLNR-1` today.
- Resumability §2b: `docs/method/` carries `ORCHESTRATOR.md`, `DISCO-ROLE.md`, `TASK-ROLE.md`,
  `CLNR-ROLE.md` (+ `DSNR-ROLE.md`, `RNR-ROLE.md`). PASS for every role. `docs/orch/BOARD.md` +
  `ORCH6-BRIEF.md` answer "what is the state?". `docs/tasks/TASK-SIGNBOOK-*.md` findable from the
  identifier alone. PASS.
- Merged-today tasks all carry a report and a `-VERIFICATION.md`: `SIGNSTRIP`, `SIGNDOOR`,
  `ANALYTICS` (ledger line present for each).
- Worktree pool: `wt-1`/`wt-2` at `6ffbd0df` clean, `wt-3` at `14140564` clean and an ancestor of
  `main`. No unmerged branch on disk. Nothing moved.
- **CLNR: clean.**

### 2 · Premise re-measurement (in progress)
- ⚠️ `bookings_status_check` in production permits twelve values and **`requested` is NOT one of
  them**:
  `draft available unavailable pending pending_slot pending_payment confirmed cancelled expired
  completed scheduled no_show`.
  **TASK-LIFECYCLE §2b says only `approved` and `moved` are missing — that is wrong; `requested` is
  missing too.**
- `TASK-LIFECYCLE` is **specced, not dispatched, not merged** (`docs/orch/BOARD.md` RESUME), and is
  itself blocked on two owner answers plus a §6 shape review.

### 3 · THE DESIGN, LOCKED — every piece converges on a named incumbent
| The owner's step | Incumbent found | What I do |
|---|---|---|
| 3 details first | `Onboarding.tsx` `details` step (SIGNDOOR) | nothing — already first |
| 4 then sign | `sign` step | nothing — already after details |
| 5 then the offering | `shop` step + `create_my_purchase` (draft) | make it REACHABLE from signing (it is not, see §4) |
| 6 then a day and time | ⚠️ **nothing in the wizard**; `request_open_time` + `CalendarPage`'s "Request this time" | NEW `time` step, calling the incumbent |
| 7 submit the request | `request_open_time` → `bookings.status='pending'` + `booking_change_requests(kind='new')` + `notify_staff` | NEW `submit` step → `submit_my_booking_request`, which CALLS `request_open_time` |
| 8 one email, docs + order + booking | `document_delivery_holds` + `deliver_executed_document_set` + `/api/deliver-documents` + `DOCUMENT_SET_PARTY_COPY` | hold at `sign`, release at submit, with order+booking context |
| 9 overview modal | `AppOverviewModal` | verify only |
| 10 staff notification AND email | `notify_staff` (in `request_open_time`) + `/api/request-received` + `REQUEST_RECEIVED` template | link a `requests` row (channel `booking`) so the incumbent alert carries order + time — **no endpoint change at all** |

**Payment (Trap 2):** gated on `arrivedWithOrder` — `my_onboarding_state().purchase` present at MOUNT.
That IS the staff-provisioned door, and it keeps today's machine unchanged, `payment` step included.

### 4 · ⚠️ THE BLOCKER, FOUND BEFORE ANY EDIT (§5.7)
`Onboarding.tsx:989-996` — when the last signature lands:
`if (next.purchase && !next.purchase.paid) enterPayment(); else setStep(slots|done)`.
**A self-serve `/sign/rider` visitor has NO purchase, so the else branch runs and they land on
"You're all set" with nothing bought.** The `shop` step is reachable ONLY from `enterPayment()`,
which is only called when a purchase already exists, or from `?step=shop`. **The offering step is
unreachable for exactly the person it was built for.** That is the owner's *"what is blocking a new
visitor"*, and the re-order fixes it as a side effect.

### 5 · ⚠️ WHERE THE SPEC IS WRONG (re-measured, D20)
1. §2: *"sign comes AFTER shop"* — **false.** `:90` is a TYPE UNION, not an order. At runtime
   `signCurrent` runs before `shop` on every path. The owner's 4-before-5 is already true.
2. Trap 1 / front matter: `requested` is not TASK-LIFECYCLE's to add alone — **`requested` is not a
   legal `bookings.status` today at all** and LIFECYCLE §2b does not notice it is missing.
3. Trap 4 (loop back to sign an offering's extra document) — **superseded by CR-98 A1**, which
   ORCH6's addendum states as *"no special case"*. `trg_documents_when_order_opens` is the general
   rule and it already exists.

### 6 · ⚠️ THE wt-1 BRANCH COLLISION — 2026-09-01 ~14:19, and what it cost
Another thread switched `wt-1` onto `task/lifecycle` while this thread was working in it. Three
SIGNBOOK commits therefore landed on LIFECYCLE's branch, and LIFECYCLE's ledger commit landed
between them. **Reclaimed, with one correction to the instruction I was given:**
- `git branch -f task/signbook HEAD` **alone would have orphaned `4701208e`** — this thread's
  FIRST commit (the CLNR result and the `requested`-is-not-a-legal-status measurement). It is not
  an ancestor of the collided HEAD, because `git checkout task/lifecycle` had reverted the tracked
  ledger file off disk; the later `>>` append then rebuilt it starting at section 3.
  **Sections 1 and 2 above are restored from that commit.**
- LIFECYCLE's own work was verified safe BEFORE anything was deleted: `wt-2` holds
  `task/lifecycle-b` with the identical ledger commit (`69afcd2a`) and its three migrations
  committed at `5df1422b`. The three untracked copies sitting in `wt-1` were byte-compared against
  `wt-2`'s and moved out of this worktree rather than deleted.
- `654e1ed5` (LIFECYCLE's ledger) is dropped from this branch by rebase, not by force-move.
- ⚠️ **`request_open_time` is LIFECYCLE's under D35 and this thread does not edit it.** SIGNBOOK
  CALLS it and inherits whatever status it writes — which is the whole reason the end-cap was
  built as a call rather than as a second insert.

## RESUME — FINAL
**DONE.** Report at `docs/reports/TASK-SIGNBOOK-REPORT.md`. Branch `task/signbook` in `wt-1`, five
commits, 0 behind `origin/main`. Migration `20260901T1420` applied to production and re-verified
AFTER LIFECYCLE's migrations landed (D35). Not pushed.
**One ASK-OWNER open:** CR-98 step 9 (feed) vs TASK-ONBOARD §5 (dashboard) behind the overview modal.

### 7 · The ASK-OWNER came back — step 9 lands on the community feed
Owner, 2026-09-01, answering which surface sits behind the overview modal: the dashboard route
exists to surface notifications, but on this first login every notification would be about the item
they just booked, or about missing payment/documents — *"this flow handles all of that in one
sweeping set of steps so there cant be anything missing… they need to see the community feed as the
first thing after closing the modal."* **Verbatim in the report, criterion 3.**
🔒 `TASK-ONBOARD` §5 is reversed; `Onboarding.tsx:911` → `/app`. Proven in the browser (probe now
25/25) by asserting the DESTINATION, not the `navigate()` argument.
⚠️ **ORCH owes this a `CR-98 · A4` entry in `docs/reference/CHANGE-ORDER-LEDGER.md`** — not filed
here because `LIFECYCLE` is live and that file is not this thread's.
