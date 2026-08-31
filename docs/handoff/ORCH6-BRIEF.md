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
1. **`docs/handoff/RUN-QUEUE.md`** — ⚠️ **what to run, in order, with model settings.** Start there.
2. **`docs/ORCHESTRATOR.md`** — the role. ⚠️ **A previous thread ran this role a whole session without
   reading it and the owner caught it.**
3. **`docs/handoff/02-THE-SIX-STEP-METHOD.md`** — how he works, in his words.
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
⚠️ **Blocked on the messaging A/B (§5). If B, Community is Catalog alone.**
**Home:** whatever next touches `AppLayout.tsx` + `pageRegistry.ts`. **Nothing owns them now.**

### CR-86 · the books ⚠️ **THE LARGEST UNSPECCED ITEM, AND IT HAS A DEADLINE**
**Four gaps, in `docs/CHANGE-ORDER-LEDGER.md` — read the full entry, it is long and measured:**
1. **Services delivered and never recorded** — lease clients owed care under **unexecuted** agreements,
   plus clients with no lease at all. ⚠️ **Unrecorded REVENUE. This is his data pass, not code.**
2. **Discount + comp designation** — ⚠️ **`purchase_items` has NO discount, comp, list-price or reason
   column.** A discounted sale is indistinguishable from a cheap one.
3. **Cost tracking** — ⚠️ **THE SPINE ALREADY EXISTS AND IS EMPTY:** `resources` · `resource_lots`
   *(with `unit_cost`, `vendor_contact_id`)* · `consumption_events` *(with `horse_id`,
   `administered_by`)* · `cost_allocation_rules` *(`scope` ∈ horse/lease/board/default,
   `payer_contact_id`, `share_pct`)* · `billable_lines`. **0 rows in all five.** ⚠️ **Establish why it
   was never driven before driving it** (D18).
4. **The P&L** — money in/out, discounts in a period, paid-vs-discounted on one sale.

**⚠️ THE DEADLINE, AND IT IS THE MOST IMPORTANT LINE IN THIS FILE:**
`revenue_summary` computes `coalesce(nullif(p.amount_paid, 0), p.amount, 0)`. **A zero becomes NULL
and falls through to the FULL LIST PRICE.** ⚠️ **So a comp recorded as the owner intends — paid,
`amount_paid = 0` — books as full-price REVENUE and records no loss. A double error in one direction.**
✅ **Verified: all three paid orders are genuine and ZERO comps exist, so the books are clean TODAY.**
⚠️ **THE COMP DESIGNATION AND THE `revenue_summary` FIX MUST LAND BEFORE HIS DATA PASS ENTERS THE FIRST
COMP.** After that the error is retroactive and every P&L inherits it silently.

**The cost model, ruled by him:** the trigger is **when the cost becomes KNOWN**, not the cadence —
**STANDING** *(known amount, monthly: boarding, bedding, feed)* · **ON USE** *(known when
administered: supplements, medications)* · **ON EVENT** *(unknown until invoiced: farrier)*.
⚠️ **"Annual" is a reporting bucket, NOT a cadence — do not model an annual schedule for farrier.**
⚠️ **A purchase is NOT a cost:** a year of supplements is not twelve months of expense on the purchase
date — which is exactly why `resource_lots` and `consumption_events` are separate. **On use and on
event are BUILT. Only STANDING is missing, and it must be per-horse, never one company line.**
⚠️ **Do not fake a lot for a standing charge — a phantom quantity corrupts `on_hand`.**
**Boarding is confirmed a cost WE PAY, company-borne, attributed through a horse.**

**Who does what:** ⚠️ **Claire LOGS the event; either of them attaches the money afterwards.**
**A cost record must be valid BEFORE its price is known** — the invoice arrives later. ⚠️ **A model
demanding a price at logging time makes her guess or skip, and a skipped log is a permanently missing
cost.** **Inputs live on her working surfaces — the horse, the care item, the day — NEVER on a books
screen.** **The books are his; the KPI is a dashboard zone at two depths.**

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

| # | Question | Blocks |
|---|---|---|
| 1 | ⚠️ **The messaging A/B** *(`04-OPEN-QUESTIONS.md` §1)* — do notes panels become the inbox **(A)**, or is the collective page retired **(B)**? ⚠️ **ORCH5 recommends A**, his own reason: *"not needing to look at a specific place for a specific thing."* | **CR-85** — if B, Community is Catalog alone |
| 2 | **Claire's Ops zone list** | FIX6 step 5 |
| 3 | **Is a comp's loss the LIST price or the ORDER-LINE price?** *(they diverge when a discount and a comp meet on one order)* | CR-86 |
| 4 | **Does a standing cost stop by itself?** A horse that leaves must stop accruing boarding **or the P&L drifts quietly every month.** | CR-86 |
| 5 | **Does a Marketing planning store exist?** ⚠️ **If not, that is a build inside a build — flag it, do not invent a campaign tracker.** | FIX6 |
| 6 | **Madeline Do's two standing slots**, and what happens to her four existing bookings *(Wed 17:30 · Fri 08:00 · Mon 17:30, plus the 13-hour midnight row)* | ⚠️ **He said "handled later today" 2026-08-31 — CHECK BEFORE ASKING AGAIN** |

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
Everything committed and pushed · `docs/handoff/` updated *(the only live lineage)* · new settled
decisions into `CLAUDE.md` as D-rules · a memory entry for anything outliving this repo · and the
ORCH7 handoff written as **instructions, not a status report**.
⚠️ **The test: nothing this thread knows exists only in this thread.**
