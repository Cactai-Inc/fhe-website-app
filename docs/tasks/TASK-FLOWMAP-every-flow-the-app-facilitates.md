# TASK-FLOWMAP — every flow this app facilitates, end to end, and where each one breaks

**Read-only. This task changes no code and runs no migration. Its entire output is documents.**

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Not a Sonnet task: tracing a flow across
surface → RPC → trigger → email → terminal state requires judging *where a chain actually
stops*, which is the single thing this project has been worst at seeing.

⚠️ **THIS IS LARGE. Work the phases IN ORDER and commit after each.** If context runs short, stop
at a phase boundary and report honestly. **Phase 1 is the owner's stated minimum** — a complete
Phase 1 is worth more than four phases begun.

---

# 1. WHAT THIS SERVES — the owner's words

> **Owner, 2026-08-20:** *"I also need a flows map for the onboarding, booking request,
> authenticated session booking, contracts, and fullfilment processes at minimum, if possible i
> need all of the flows the app and website contain based on visitor/customer/admin/staff actions
> that we undertake sequentially, basically all the different workflows and user facing purchase or
> engagement flows the repo was designed to facilitate."*

This is **step 2 of the owner's three-step plan** (`docs/archive/HANDOFF-ORCH3.md` §3).

**The complement already exists and is your input, not your job.**
`docs/reference/SURFACE-INVENTORY.md` (REACHAUDIT, merged `d138017`) maps all 128 routes: reach,
role gate, CRUD, write class, D19 flags. **The inventory says where a person can GO. This map says
what must HAPPEN, in sequence, and where the sequence stops.** Do not re-derive the surface layer —
cite the inventory row and move on.

**And this task owns the layer REACHAUDIT structurally could not see.** That audit's calibration
found only 4 of the walkthrough's 8 instances because the other 4 are RPC/trigger call-graph
defects invisible to a source-only surface audit. **`deal_autocomplete_on_execution` was handed
forward to this task by name** (`TASK-REACHAUDIT-REPORT.md` §3). It is yours.

---

# 2. WHAT WAS MEASURED (orchestrator, 2026-08-20, main @ `8186b47`)

Record the commit you trace in every output header — main moves under you.

**Production (direct `psql`, `.env.db` line 1):**
- **612** functions in `public` · **133** non-internal triggers · **145** base tables.

**Repo:**
- **34** `api/*.ts` serverless endpoints — the mail/Stripe/admin edge. **Vercel-only; they do not
  run locally**, which is why no thread has ever proven a send.
- **5 Vercel cron jobs, exact schedules from `vercel.json`** — these are **actors**, not config:

| endpoint | schedule | what it is |
|---|---|---|
| `/api/notifications-nudge` | `0 16 * * *` daily | the nudge |
| `/api/expire-holds` | `0 * * * *` hourly | releases held inventory |
| `/api/calendar-reminders` | `0 * * * *` hourly | booking reminders |
| `/api/delivery-sweep` | `0 * * * *` hourly | retries document delivery |
| `/api/mint-monthly-allotments` | `20 8 * * *` daily | mints recurring credits |

⚠️ **None has ever been observed running** (`OPEN-ITEMS-2026-08-18.md` §4). **A cron whose effect
you cannot demonstrate is an unproven step in every flow that depends on it — say so per flow.**

---

# 3. THE INCUMBENTS — absorb these, never re-derive them

**This project's defining failure is building a second thing beside the first.** Four documents
already trace parts of this. **Read them first, cite them, and extend — do not repeat their work.**

| document | what it already covers | your relationship to it |
|---|---|---|
| `docs/reports/TASK-FLOWTRACE-REPORT.md` | **the deepest incumbent** — invitation → provisioning → order → payment → booking → credits → fulfilment, 15 sections, incl. THE INVERSION and the kiosk being implemented twice | **Absorb. This is Phase 1's spine.** Re-verify its claims still hold at `8186b47` (CLOSEOUT changed this area), then carry them forward with citation. Do not re-walk what it settled. |
| `docs/reports/RETEST-CHECKLIST.md` | the 40-step ordered walk (CLOSEOUT phase 4), in the order a real person moves | **Use as the ordering authority.** Where your flow sequence and its step order disagree, one of you is wrong — say which. |
| `docs/reference/DUAL_IDENTITY_TRACE.md` | act-as-company attribution (D7's behavioural contract) | **Cite as the variant rule** wherever a staff actor can act as the company. |
| `docs/method/FLOW-PROGRAM-WAVES.md` | the wave program — which flows were built when | Use to date a flow, not to describe one. |

**If your map contradicts an incumbent, say so explicitly and prove it.** Threads have corrected
the orchestrator more often than the reverse.

---

# 4. THE DELIVERABLES

### 4a. `docs/reference/FLOW-MAP.md` — the index and the durable artifact

- **The flow register**: one row per flow — ID · name · initiating actor · entry surface (cite the
  `SURFACE-INVENTORY` row) · terminal state · **status: `WORKS` / `BREAKS` / `PARTIAL` / `UNPROVEN`**.
- **The actor register**: every human role (visitor · lead · guest · customer · client · member ·
  parent/guardian · party/counterparty · vendor · instructor · staff · admin · platform owner) and
  every **system actor** (Stripe · the mail edge · each of the 5 crons · Google Maps · Supabase
  auth), each with the flows it participates in.
- **Cross-flow findings** — anything true of many flows, which is where the expensive defects live.
- **The areas each flow crosses.** For every flow, list the surfaces it touches **grouped by the
  area of the app they belong to** (Records · Ops · Booking · Contracts · Catalog · Account · the
  public site · Admin/Settings). ⚠️ **Do not invent an area taxonomy** — derive it from the nav
  groups in `AppLayout.tsx` and `pageRegistry.ts` as they exist, and where a flow crosses areas,
  **say so and name the seam**. A flow that crosses four areas is telling you either that the areas
  are wrong or that the flow is — and which one is the most valuable judgement in this document.

⚠️ **KNOW YOUR CONSUMER.** This map's next reader is a separate review thread producing the
**refactor's area specification** — dividing the app into the areas it *should* have and speccing
each. **That thread needs your seams, not your prose.** A flow whose sequence is described but
whose area crossings are not recorded is only half-useful to it.

### 4b. `docs/reference/flows/<AREA>.md` — the sequences

One file per area (see §5). **Every flow uses this identical record. No per-area format drift.**

```
## F<n> — <name>
TRIGGER      who, what action, which surface (inventory row)
ACTORS       human + system
PRECONDITION what must already be true (account? document signed? credit? payment?)

SEQUENCE     numbered. each step:
             actor action → surface file:line → function/RPC called → table(s) written
             → WHAT EACH PARTY SEES (client / staff / nobody)

NOTIFIES     which email or alert fires, from which api/ endpoint, to whom, logged where
TERMINAL     what "done" looks like as data (the exact row state)
VARIANTS     minor/guardian · company vs personal (cite DUAL_IDENTITY_TRACE) · gift · lead vs
             authenticated · single vs recurring
BREAKS       numbered, each with file:line or query proof, each marked
             BROKEN (proven) / UNPROVEN (cannot verify without a browser or a real send)
```

⚠️ **"WHAT EACH PARTY SEES" is not optional.** The owner's sharpest complaint is *"i dont know
what she is seeing, what emails shes getting"* — four ledgers are written and none is read back
to a human (D19 corollary). **A step nobody can see is a finding, and this column is how it
surfaces.**

### 4c. `docs/reports/TASK-FLOWMAP-REPORT.md`

Method · what was absorbed from each incumbent · findings ranked · **flagged-not-fixed** · teardown.

---

# 5. THE PHASES — in this order

## PHASE 1 — the owner's stated minimum → `flows/onboarding.md`, `flows/booking.md`, `flows/contracts.md`, `flows/fulfilment.md`

1. **Onboarding** — invitation → `provision_client_invitation` spine → activation → account setup →
   document assignment (`contact_required_documents`) → the signing wall (`my_wall_state`) →
   affiliation derivation (`apply_affiliations`). Include: `promote_contact_to_account`,
   invitation lifecycle (`record_invitation_failure`, `supersede_invitations`, expiry), the
   kiosk/`RELEASE_GENERAL` visit path, the minor/guardian variant (`is_minor_contact`), and the
   **already-activated** case CLOSEOUT just fixed.
2. **Booking request** — the *unauthenticated* path. All three funnels (`/horse`, `/lessons`,
   `/book/support`) → the page-2 question engine → `submit_public_request` → `requests` →
   `requests_capture_contact` → the staff alert. **Including which funnel entries never reach the
   alert spine.**
3. **Authenticated session booking** — the *logged-in* path. Availability → booking →
   credit debit-or-create → `schedule_lesson_session` → `complete_lesson_session` →
   `_refund_booking_credit` on cancel/reschedule. **Include the recurring/care-plan variant**
   (`set_recurring_days`, `generate_monthly_lessons`, the `mint-monthly-allotments` cron).
4. **Contracts** — lease (`start_lease_contract_v2`, the clause engine) and sale
   (`HORSE_SALE_V2`/`BILL_OF_SALE`, the deal envelope): compose → complete fields → gate → sign →
   execute → supersede. **Include D14 change-review** (seen-is-approved) and the
   party/counterparty variant. ⚠️ **The signing freeze is in force — trace, never execute.**
5. **Fulfilment** — D6's spine: `purchase_items` → `fulfillment_units` by `config_kind` →
   consumption (booking / evaluation delivery / document execution) → `status_events` → terminal.
   **`deal_autocomplete_on_execution` is resolved here** — does it fire, or is it dead?

## PHASE 2 — the rest of the engagement and purchase flows → `flows/commerce.md`, `flows/staff-ops.md`

Purchase and payment (cart → `purchases` → `PUR-000001` → Stripe checkout → **and** the
Zelle/cash `mark_purchase_paid` path → receipts/`receipt_sends`) · gift purchase and redemption
(`redeem_gift`, D8's auto-account) · evaluation report delivery and sharing · lead → client
conversion · horse intake and records · document delivery and re-delivery · account/profile
self-service · team/staff management · notifications and alerts.

**The list above is what the orchestrator could evidence — it is a floor, not a ceiling.**
**Complete it from the code.** Any user-facing engagement or purchase path you find that is not
listed is exactly what the owner asked for; add it.

## PHASE 3 — the system actors and the cross-flow view → back into `FLOW-MAP.md`

Each system actor as an actor: what calls it, what it calls back, what happens when it fails, and
whether its effect has ever been demonstrated. **Then the cross-flow findings** — a defect
appearing in six flows is the most valuable output of this task.

---

# 6. METHOD — one grounding read per context, then batch judgment

Per L3: **read each shared context ONCE**, then judge every flow against those reads.
**612 functions is far too many to read** — you do not enumerate the database. **You trace
forward from entry points.**

1. Read the four incumbents (§3) once each. Read `SURFACE-INVENTORY.md` once.
2. `ls api/` + read the endpoints once → the mail/Stripe/cron edge.
3. **One `psql` pass for the trigger map** — `pg_trigger` joined to its table and function, all
   133 rows, once. This is the layer REACHAUDIT could not see; get it in one read.
4. Then per flow: start at the entry surface, follow the call into `src/lib/**`, into the RPC, into
   its triggers, out to any `api/` endpoint. **Read a function body only when the flow reaches it.**
5. Verify terminal states with **direct SQL against production** (read-only `SELECT`s).

**No subagents (standing repo rule). No writes to production — `SELECT` only.**

---

# 7. THE TRAPS

- **A green function is not a step that happens.** The dominant defect class here is a correct
  function nothing calls. **For every step, prove the call site exists** — that is the whole point.
- **`deal_autocomplete_on_execution` is trapped in a branch that never runs** (CONTRACTWALK).
  Verify at `8186b47` — **CLOSEOUT §1.7 claims it fixed this. Check before repeating it as broken.**
- **`bookings` has three owner columns** — `account_contact_id`, `client_id`, `account_user_id` —
  and **32 of 43 scheduled bookings have NULL `account_contact_id`** (W6). Any flow step reading
  bookings must say **which column it filters on**, because that decides what the user sees.
- **Availability is stored as `booking` rows** (275 `available` vs 43 real, W4). "A booking exists"
  is ambiguous — always qualify.
- **Two disagreeing completeness checks** existed on contracts (A2). CLOSEOUT claims one gate now.
  **Verify, don't assume.**
- **Comments lie.** `pageRegistry.ts:125` was stale and caught the orchestrator; ONETEAM's deferral
  rode on a comment stale within the hour (D20). **A state claim in a doc is a hypothesis.**
- **D1a** — `admin@cactai.io` being denied by tenant-gated functions is CORRECT, not a break.
  Three threads got this wrong.
- **Empty is not a finding.** Pre-launch counts are the expected state. A break is something that
  would still be wrong once the feature is used.
- **`test:db` is broken** (46 red files, documented baseline). Cite nothing from it.
- **The signing freeze is in force.** Trace signing; never execute a signature.
- **Templates are never deleted** (D16); **executed documents are evidence** (61 of them).
- **Do not propose fixes inline.** A break gets recorded, not repaired. Fixes are specced after.

---

# 8. OUT OF SCOPE

- **Any code change, migration, or production write.** Documents are the entire diff.
- UI/visual design opinions — the inventory owns naming, this owns sequence.
- The 535-item `DECIDE.md` sheet.
- Re-walking anything `TASK-FLOWTRACE-REPORT.md` already settled — **absorb it instead**.
- Browser verification. **No worktree gets a staff login** — anything needing a real render or a
  real send is marked **UNPROVEN**, never simulated.

---

# 9. CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-flowmap`, branch `task/flowmap`.
- **Commit after every phase. Do not push** — the orchestrator merges.
- Stage explicit paths; **never `git add docs/`** (it has swept other threads' files twice).
- Contended files: **none** — you create new files only. If existing code needs a fix, it goes in
  flagged-not-fixed with the diff, and the orchestrator applies it.
- **TEARDOWN:** no dev server, no vitest, `psql` sessions closed. End the report with a process
  census (`ps aux | grep -E "vite|vitest|node|psql" | grep -v grep`) proving nothing was left running.

---

# 10. THE TEST THIS MUST PASS

1. **All five of the owner's named flows are complete in Phase 1**, each with every field of the
   §4b record filled — no blank BREAKS section, no blank "what each party sees".
2. **Every flow's entry surface cites a real `SURFACE-INVENTORY.md` row**, and every step naming a
   function cites `file:line` or the RPC name.
3. **Every one of the 5 crons appears as an actor** in at least one flow, or is explicitly recorded
   as belonging to no flow — which would itself be a finding.
4. **`deal_autocomplete_on_execution` is resolved**: fires (with proof) or is dead (with proof).
   It has been handed forward twice and does not survive this task unanswered.
5. **Every claim carried from an incumbent is re-verified at `8186b47` or marked
   "inherited, not re-verified"** — CLOSEOUT changed contracts, care plans and funnels since those
   reports were written.
6. **The register's status column is justified**: every `BREAKS` has proof; every `UNPROVEN` says
   exactly what would prove it (a browser step, a real send, a cron observation).
7. `git diff --stat` shows **documents only, zero code, zero migrations**.

---

# 11. REPORT

`docs/reports/TASK-FLOWMAP-REPORT.md`. **THE REACH and THE TELL are N/A** — this task is read-only
and its deliverable *is* the map.
