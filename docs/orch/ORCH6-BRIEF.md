# ORCH6 — YOUR BRIEF

**Rewritten 2026-08-31 by ORCH5, at the owner's request, before compaction.** ⚠️ **This file
instructs. It supersedes every earlier version.** If you finish it and still have to ask him how to
operate, it failed.

## WHERE YOU ARE

```
repo        /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch      main — pushed and clean
database    Supabase lrstswfxfsezdmvkvukc — connection string is LINE 1 of .env.db (gitignored)
platform    macOS. Every path above is absolute and real.
```

⚠️ **`cd` into the repo before anything.** A fresh session starts elsewhere.

## READ, IN THIS ORDER
1. **`docs/orch/RUN-QUEUE.md`** — ⚠️ **what to run, in order, with model settings.** Start there.
2. **`docs/method/ORCHESTRATOR.md`** — the role. ⚠️ **A previous thread ran this role a whole session without
   reading it and the owner caught it.**
3. **`docs/method/02-THE-SIX-STEP-METHOD.md`** — how he works, in his words.
4. **`CLAUDE.md`** — D1–D33, and ⚠️ **no subagent delegation in this repo.**

---

# 1. WHAT IS DONE — do not re-audit it

**Seven `TASK-AR*` research reports** *(AR1–AR7)*: written, audited against production by ORCH5,
merged. **Three fix threads merged:** `FIX1` *(front door + signature engine)*, `FIX2` *(instructor
stamp, standing slot, record reach)*, `FIX3` *(nav sections, activity surfaces removed)*.
**Also applied directly:** the `anon` grant on `record_signature` / `remove_my_signature` revoked and
proven; booking `f7881be9` restored to `hello@`; `ORCHESTRATOR.md`'s stale "61 EXECUTED" corrected
to **71**.

**Baselines:** typecheck 0 · typecheck:api 0 · **lint 46** *(not 48 — several docs still say 48)* ·
build succeeds · `test:db` 51 files red **and that is documented baseline, citable as proof of
nothing.**

# 2. THE QUEUE — `RUN-QUEUE.md` is authoritative

| | Task | Model | Note |
|---|---|---|---|
| **1** | **`TASK-FIX4`** — input is never lost | Opus · MAX | ⚠️ **READY. Nothing in the 2026-08-31 conversation changed its scope** — verified. It is forms, modals, normalisation, persistence |
| **2** | **`TASK-FIX6`** — Ops/Admin boards + error reporting | Opus · HIGH | after FIX4 *(the error-report form is a form)*. ⚠️ **Has a MANDATORY PAUSE — see §4** |
| **3** | **`TASK-FIX5`** — repo hygiene | Sonnet · HIGH | ⚠️ **LAST.** It moves files everything else cites |
| **4** | **the twelve zone sweeps** | Opus | ⚠️ **SEVEN threads, not twelve** — `docs/tasks/ZONE-SWEEPS-A1-A12.md`, grouped by shared spine |
| **5** | the enumerated status document → his chat thread → **ORCH7** | | then **ORCH8** for his UVT findings, **ORCH9** for the client side |

# 3. ⚠️ NEW WORK CAPTURED 2026-08-31 — NOT YET SPECCED, AND IT IS THE BULK OF WHAT REMAINS

**Four change requests were captured after the fix threads were written. `CR-83`, `CR-84` are BUILT
INTO `FIX4`. `CR-85` and `CR-86` ARE NOT SPECCED — they are yours to spec.**

### CR-85 · the nav is three sections *(small)*
**`Community · Management · Admin`**, with **People dissolving into Community** *(it is two rows —
Contacts and Stable)*. ⚠️ **The order is already correct; the only change is People dissolving.**
⚠️ **The orchestrator argued against this and was WRONG** — Catalog and Messages **are** community
content *(the view lives in Community, the editor in Admin — `Products` at `pageRegistry.ts:267`)*.
✅ **UNBLOCKED — `CR-87` rules the Messages page SURVIVES, so Community keeps both rows.**
**Home:** whatever next touches `AppLayout.tsx` + `pageRegistry.ts`. **Nothing owns them now.**

### CR-86 · the books ⚠️ **THE LARGEST UNSPECCED ITEM, AND IT HAS A DEADLINE**
**Four gaps, in `docs/reference/CHANGE-ORDER-LEDGER.md` — read the full entry, it is long and measured:**
1. **Services delivered and never recorded** — lease clients owed care under **unexecuted** agreements,
   plus clients with no lease at all. ⚠️ **Unrecorded REVENUE. This is his data pass, not code.**
2. **Discount + comp designation** — ⚠️ **`purchase_items` has NO discount, comp, list-price or reason
   column.** A discounted sale is indistinguishable from a cheap one.
3. ⚠️ **Cost tracking — SIMPLIFIED BY THE OWNER, 2026-08-31. A MONTHLY COST SHEET ON THE HORSE
   RECORD, TYPED IN AT MONTH END.** *"the simplest thing to do is give a space on the horse record for
   recording the costs at month end. having the right lines to input $ is better than trying to figure
   out how to automate it from a one time input."*
   **One row per horse per month. Lines: boarding · bedding · feed · supplements · medications · vet ·
   farrier · other+note. Annual = the sum of the months; no separate annual model.**
   ⚠️ **A blank line is NOT zero** — "no medication this month" and "not entered yet" must be
   distinguishable or the annual roll-up silently under-reports.
   ⚠️ **HE RULED OUT THE AUTOMATION, and the reason is sound: every figure is already known at month
   end by the person who was there. Deriving it would mean logging every administration all month to
   reconstruct a number readable off an invoice — more input, not less.**
   ⚠️ **THEREFORE: `resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` ·
   `billable_lines` — all built, all 0 rows — STAY UNDRIVEN.** A per-event consumption ledger is
   exactly what he declined. **Leave them (D32); say so explicitly so a later thread does not "finish"
   them.** *(`cost_allocation_rules` may matter later for CLIENT-owned horses — who pays — but not for
   this, which is company-borne cost on our own horses.)*
4. **The P&L** — money in/out, discounts in a period, paid-vs-discounted on one sale.

**⚠️ THE DEADLINE, AND IT IS THE MOST IMPORTANT LINE IN THIS FILE:**
`revenue_summary` computes `coalesce(nullif(p.amount_paid, 0), p.amount, 0)`. **A zero becomes NULL
and falls through to the FULL LIST PRICE.** ⚠️ **So a comp recorded as the owner intends — paid,
`amount_paid = 0` — books as full-price REVENUE and records no loss. A double error in one direction.**
✅ **Verified: all paid orders are genuine and ZERO comps exist, so the books are clean TODAY.**
⚠️ **CORRECTED 2026-08-31 BY ORCH6, FROM THE FUNCTION BODIES — the mechanism above is not yet armed.**
`grant_lesson_credit` writes a comp as `amount = 0, amount_paid = 0`, so `nullif` falls through to a
ZERO and books nothing. ⚠️ **The trap arms itself the moment a line carries the LIST price — i.e. the
moment the designation is built.** **So the fix and the designation must ship in ONE branch.** Full
working: `docs/tasks/TASK-BOOKS1-what-a-sale-was-worth.md` §3, and the ledger's CR-86 addendum.
*(Also: there are FOUR paid orders now, not three — `PUR-000333 $55` was paid 2026-08-31.)*
⚠️ **THE COMP DESIGNATION AND THE `revenue_summary` FIX MUST LAND BEFORE HIS DATA PASS ENTERS THE FIRST
COMP.** After that the error is retroactive and every P&L inherits it silently.
⚠️ **The cost simplification does NOT touch this — that is the COST side, this is the REVENUE side.
Both are needed for a P&L; only the cost side got smaller.**

**Who enters what:** ⚠️ **Claire is the one positioned to know what happened; the month-end sheet is
money, so either of them may enter it — CONFIRM WITH HIM (§5).** **Inputs live on her working surfaces
— the horse record — NEVER on a books screen.** **The books are his; the KPI is a dashboard zone at
two depths.**

### CR-88 · marketing planning · the campaign builder · financial analysis ⚠️ **ALL GREENFIELD**
**Verified 2026-08-31: no `campaign*`, `market*`, `promo*` or `audience*` table exists.**
*(`segment_categories` matches on name only — catalog segment → onboarding token. **Unrelated.**)*
⚠️ **NOT `FIX6`'s work: FIX6 builds the Marketing BOARD; these build what it shows.**
- **Marketing planning** — campaigns with a state *(planned · running · finished)*, window, channel,
  note. ⚠️ *"What is still in planning"* is the part with no store.
- **The campaign builder** — ⚠️ **its measurement side ALREADY EXISTS.** `TASK-ORIGIN` shipped
  `contacts.client_origin` / `contact_channel`, vocabulary in `lookup_options`, editable at
  `/app/ops/admin/editor`. **A campaign's result is contacts arriving with its origin.** ⚠️ **Do NOT
  build a second attribution vocabulary** (D18). **Both columns are unpopulated until his backfill, so
  results read empty until then — say so, never present zero as a result.**
- **Financial analysis** — ⚠️ **a page with INPUTS, not a report.** Revenue *(exists)* + CR-86's
  per-horse sheet + ⚠️ **COMPANY-level expenses that are NOT per-horse — insurance, wages, software,
  signage. CR-86 does NOT cover these; it is horse-attributed cost only. Its own line, not a stretched
  horse sheet.** ⚠️ **Inherits CR-86's `revenue_summary` deadline.**

⚠️ **SEQUENCE — building out of order produces empty surfaces:**
**(1)** CR-86's cost sheet + comp/discount designation + the `revenue_summary` fix → **(2)** the
financial page → **(3)** marketing planning + campaign builder *(whose results wait on his
attribution backfill)*. ⚠️ **FIX6's Sales and Marketing boards are NOT blocked by any of this** —
they surface what exists and name what does not.

# 4. ⚠️ `TASK-FIX6` HAS A MANDATORY PAUSE

**The dashboard model was refined across six messages. `docs/tasks/TASK-FIX6-ops-and-sales.md` §2b
carries the settled version as one table — read that, treat conflicting detail above it as working
notes.**

**Seven views, two families.** ⚠️ **Claire is OPS; the owner is ADMIN — home boards, not lenses.**
He cycles into **Sales · Marketing**; she does not cycle at all. **Trainer / Instructor / Care-taker**
are job roles *(instructor ⊂ trainer; care-taker shares the horse side)*.
⚠️ **Ops is COMPOSED from the other boards, never authored** — deep on the job-role side, a snippet of
sales/marketing. ⚠️ **A zone has TWO DEPTHS, not two definitions**, and **every number on Ops must be
the same number its focused view shows, from one read** — a summary recomputing its own figure is how
`calendar_revenue` and `revenue_summary` came to disagree **9.7×**.
⚠️ **The blocker: a `CHECK` pins `dashboard_focus` to `trainer|business`. Held views must become a
SET; `dashboard_focus` stays as the separate LANDING preference.**

**BUILD ORDER, and step 3 is a real stop:** framework → **Sales + Marketing in full** → ⚠️ **PAUSE:
hand them to the owner and ASK FOR CLAIRE'S OPS ZONE LIST** *("i can list all of the things to
include")* → Admin → Ops from his list. ⚠️ **If the list has not arrived, REPORT AND STOP. Steps 1, 2
and 4 ship on their own.**
⚠️ **The naming collision — "Admin" is also a nav section — was raised and SETTLED with no rename.
Do not re-open it.**

**Also in FIX6's scope, measured:** ⚠️ **ZERO care bookings exist** *(`bookings.kind` is `lesson` 676,
`block` 3)* — **so the assigned-helper badge has no item to sit on.** **FIX2 proved the care path is
refused without a horse AND that person's care paperwork — establish whether it is unreachable or
merely unused.** **And nothing records a helper: `instructor_user_id` is the lesson teacher.**
⚠️ **Do NOT overload it** — FIX2 just repaired a bug in that column. **An empty `shifts` table exists
(a rota, not a per-item assignment) and deserves an explicit verdict.** **An unassigned item shows NO
badge — never "Claire" by default.**

# 5. ⚠️ WAITING ON THE OWNER — do not build past these

**⚠️ THREE WERE ANSWERED 2026-08-31 AND ARE CLOSED. DO NOT RE-ASK THEM — he has already been asked
twice on one.**

| # | Question | Blocks |
|---|---|---|
| 1 | **Does a campaign need a BUDGET / spend figure?** *(the difference between "did it work" and "was it worth it" — decides whether campaigns touch the P&L)* · **and which company-level expense categories does he want?** ⚠️ **Do not invent a chart of accounts.** | CR-88 |
| 2 | **Madeline Do's two standing slots**, and her four existing bookings *(Wed 17:30 · Fri 08:00 · Mon 17:30, plus a 13-hour midnight row)* | ⚠️ **He said "handled later today" on 2026-08-31 — CHECK PRODUCTION BEFORE ASKING AGAIN** |

### ✅ CLOSED — carry these as ANSWERS, not questions
- ⚠️ **MESSAGING IS RULED — see `CR-87`. It is NOT an A-or-B and `04-OPEN-QUESTIONS.md` §1 IS
  SUPERSEDED.** **Threads STAY on their surfaces** *(lessons · horse-care records · contracts)*; **the
  Messages page ENUMERATES them in one view and is an INDEX, not a second store**; **each listed thread
  LINKS BACK to its originating surface.** ⚠️ **Do not migrate messages into a central table** (D18).
  ⚠️ **Five message-shaped tables exist and the panels may not all use the same one — establish which
  each surface uses before designing the index.** **All five are empty and that is NOT a finding.**
  ✅ **CR-85 IS THEREFORE UNBLOCKED: the Messages page survives, so Community keeps Catalog AND
  Messages.**
- ⚠️ **A comp's loss is the LIST price.** *(Asked twice. He answered once and was asked again — do not
  make it three.)* **Build consequence: `purchase_items` has only the price CHARGED, so a comp at $0
  leaves nothing to value the loss from. CAPTURE THE LIST PRICE ON THE LINE AT THE TIME OF SALE** —
  offering prices change, and valuing an old comp from today's catalogue would be wrong.
- ⚠️ **A standing cost stops by itself, because NOTHING ACCRUES.** *"we stop the cost accumulation when
  we stop inputting the data into the record."* **No sheet, no cost — so the P&L cannot drift on its
  own.** ⚠️ **But the failure mode INVERTS: a month nobody enters reads as £0, not "missing". The
  surface must show which horses have no sheet for a closed month.**
- ⚠️ **Claire's Ops zone list CANNOT arrive early** — *"i dont have claires ops zone list until i see
  the full sales and marketing dashboards."* **The FIX6 pause is therefore non-negotiable and cannot
  be short-circuited by asking sooner. Steps 1, 2 and 4 SHIP WITHOUT IT; Ops and the role boards are a
  separate later task. Do not hold the merge.**

# 6. HIS DATA PASS — after the refactor, with one exception

**Backdated orders, revenue attribution, lesson links across every account: HIS, with HIS timestamps,
AFTER the refactor** — under D30 the data is *ported*, so entering it early means transforming it
twice. ⚠️ **EXCEPT the comp designation and `revenue_summary` fix (§3), which must precede it.**

# 7. STANDING TRAPS
- ⚠️ **`DROP FUNCTION` + `CREATE FUNCTION` resets the ACL to the schema default, silently.** Restore
  grants explicitly and prove from `pg_proc.proacl`. **A `REVOKE FROM PUBLIC` alone leaves a direct
  `anon` grant standing.**
- ⚠️ **`PUBLIC EXECUTE` is on 376 of 748 functions** — an ACL proves nothing. **Call as `anon` and
  count rows.**
- ⚠️ **A state claim in a doc is a hypothesis** (D20). **Two live defects this month came from stale
  documents, not code.**
- ⚠️ **`AppLayout.tsx` is the most contended file in the repo.** One task owns it at a time.
- ⚠️ **A LIVE LEASE IS IN PRODUCTION** — Pamela Godde, `7adcd08f-fd5d-40f9-b726-634074266d7c`.
- ⚠️ **Never trust a self-reported done.** Every claim ORCH5 checked was worth checking; **three
  threads corrected ORCH5 on points of fact, and were right each time.**

# 8. HOW THIS THREAD ENDS
Everything committed and pushed · `docs/method/` updated *(the only live lineage)* · new settled
decisions into `CLAUDE.md` as D-rules · a memory entry for anything outliving this repo · and the
ORCH7 handoff written as **instructions, not a status report**.
⚠️ **The test: nothing this thread knows exists only in this thread.**
