# ZONE SWEEPS A1–A12 — twelve briefs, drafted 2026-08-29

⚠️ **DRAFTED, NOT LAUNCHED.** These run **after** ORCH6 has landed the fixes from the `TASK-AR*`
admin review. Launching them before those fixes means twelve sweeps reporting defects that are
already being repaired.

**Every sweep reads, in this order:**
1. **`docs/method/METHOD-area-sweeps.md`** — the directive, the five-part deliverable, the concurrency rule.
2. **`docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md`** — the depth requirement and the state matrix.
   ⚠️ **§2 applies unchanged: existence in code is not visibility, and one circumstance is not all
   circumstances.**
3. **Its own section below.**

**Deliverable, per `METHOD-area-sweeps.md` §1:** findings (duplicates · conflicts · wiring gaps ·
missing · stale · bad) · **the written flow inventory in prose** · the plan · test criteria ·
success at both levels. **Plus the contended-files list**, which is how the build order is computed.

⚠️ **READ-ONLY. A sweep writes nothing but its own report** — which is what makes sweeps freely
concurrent. **Report to `docs/reports/SWEEP-<Ax>-REPORT.md`. Worktree `wt-<ax>`, branch
`task/<ax>`. Commit the report only. Do not push.**

⚠️ **THE FLOW INVENTORY IS THE PART THAT WILL BE SKIMPED AND MUST NOT BE.** It is what makes the plan
checkable: it states what the area is FOR, independently of what the code currently does, so the plan
can be reconciled against it. **A plan that covers only what the sweep happened to notice is the
narrow scoping this whole method exists to end.**

---

## A1 · Identity & the person record
**Owns:** `contacts` · `profiles` · `clients` · `members` · `groups` · `invitations` · the promotion
spine (`promote_contact_to_account`, `_ensure_client_account`, `apply_affiliations`) · Records,
dossier and `Admin.tsx` surfaces.
**Governed by:** D1/D1a · D5 · D8 · D22 · D30 §4 · D31.
⚠️ **The `TASK-AR2` fixes will have just landed here.** Sweep what remains, not what was repaired —
**read `docs/reports/TASK-AR2-REPORT.md` first.** D30 names this model first in line for the rebuild.

## A2 · Access, tenancy & roles
**Owns:** RLS across 162 tables · `org_id` scoping · `has_staff_access` · `is_admin` · membership
gating · the platform-vs-tenant split.
**Governed by:** D1a — ⚠️ **being denied by tenant-gated functions is CORRECT for `admin@cactai.io`;
three threads reported it as breakage and all three were wrong.**
⚠️ **Two known facts to start from:** `PUBLIC EXECUTE` is on **376 of 748** functions, so an ACL alone
proves nothing — **call as `anon` and count rows**; and `DROP FUNCTION` + `CREATE FUNCTION` resets a
function's grants to the schema default silently.

## A3 · Catalog & the request→order spine
**Owns:** `offerings` · `requests` · `purchases` · `purchase_items` · approval · line-item editing.
**Governed by:** ⚠️ **CR-27, LOCKED, with ten validation criteria — that is the spec, build to it
exactly.** Plus D6 · D23 · D24 · D25.
⚠️ **A request has ten stages and every one ever created sits at the first; nothing can approve one.**
This area is the hinge for A4 and much of A5.

## A4 · Money
**Owns:** payments · credits · comps · discounts · receipts · revenue reporting · `status_events` as
a ledger.
**Governed by:** ⚠️ **CR-76b, LOCKED** — a payment is its own entity with its own number; the ledger
carries everything, not just what is outstanding; **the same build is split payment.** Plus D18 ·
D19 · D21 · D23.
⚠️ **Two known data faults:** 39 order events on 16 entity ids match no purchase that exists, and
`purchases.payment_method` is one column so a split cannot be recorded. **And two revenue functions
exist — `calendar_revenue` and `revenue_summary`. Do they agree?**

## A5 · Scheduling & the calendar
**Owns:** `bookings` · availability · standing slots · durations · horse limits · the calendar.
**Governed by:** D23 · D24 · D25 · CR-01…07 · CR-71 · CR-82.
⚠️ **The `TASK-AR1` fixes will have just landed here — read `docs/reports/TASK-AR1-REPORT.md` first.**

## A6 · Fulfilment & Claire's day
**Owns:** `fulfillment_units` · the day sheet · dispositions · activity and evaluation records.
**Governed by:** D6 · **D27 — evaluations and activity records live on the rider or horse record,
never locked, always logged; real deletion only at the database level.**
⚠️ **`complete` and `no_show` already exist in the vocabulary and have never been used.**

## A7 · Contracts & documents
**Owns:** templates · clauses · fields · parties · signatures · execution · supersession · the
authoring and signing surfaces.
**Governed by:** D10 · D14 · D16 · D22 · D29 · D32 · D33.
⚠️ **61+ EXECUTED documents are evidence and are never rewritten. `ClauseDocument.tsx` is
STOP-AND-PROPOSE. A live lease with a real client is in production — do not touch document
`7adcd08f-fd5d-40f9-b726-634074266d7c`.**
⚠️ **D29 records a live identity bug: `my_roles` returning empty hides proposal AND edit controls at
once. One bug presenting as two missing features.**

## A8 · Horses & the stable
**Owns:** horse records · intake · ownership · health · photos and files.
**Governed by:** D11 · D15 · D27 · D32 · CR-68 · CR-69 · CR-70 · CR-71.
⚠️ **Known and unfixed:** `HorseRecordsPage.tsx:159-162` renders a deactivated breed or colour as its
raw code, and the `b.active || b.code === r.breed` fallback is **dead code** because
`listHorseBreeds()` already filters to active. ⚠️ **The euthanasia block still shows on the shared
intake component, which is the contract path too.**

## A9 · Notifications & delivery
**Owns:** email transport · `notifications` · `document_deliveries` · crons · the alert spine.
**Governed by:** D9 — **there is no welcome email and no dunning email; both producers are deleted,
not dormant.**
⚠️ **Known:** no "an order was placed" alert exists at all; only 2 of 12 lead alerts have ever been
emailed; the barn's timezone is hardcoded in **23 places**; `pg_cron` is not installed and the Vercel
crons were never created.

## A10 · Community & content
**Owns:** feed · posts · moderation · messages · the content store · page copy.
⚠️ **`content_blocks` and `content_block_versions` are 0 rows and `get_content_block` resolves the
tenant through `current_org()`, which an anonymous visitor cannot set** — so public copy cannot be
served from the store without an anon-safe read path first. **That is a security decision, not a
build detail.**
⚠️ **The messaging A or B is still the owner's to choose** — see `docs/method/04-OPEN-QUESTIONS.md`.
**Empty message tables are NOT evidence of anything; nobody is in the app yet.**

## A11 · Admin config & the kit
**Owns:** the editor · vocabularies · branding · products · `form_definitions` · page visibility ·
the design primitives.
**Governed by:** D12 · D13 (+ its recorded exception) · D21 · D22 §0 (a recorded refusal — **do not
re-propose backing `/sign/*` with `form_definitions`**).
⚠️ **CR-37's measurements are the brief:** 33 screens build their own overlay against 7 using the
shared one · 48 hand-build the green button · 32 write their own empty state · six corner radii while
the shared fields have none.
⚠️ **The `TASK-AR4`/`AR5` nav work will have just landed here.**

## A12 · Barn operations
**Owns:** boarding agreements and charges · facilities and stalls · resources · consumption ·
employees · staff schedule.
⚠️ **Largely undriven, and that is expected pre-launch — EMPTY IS NOT A FINDING.** What matters here
is whether it is coherent and reachable, and **whether `mod.*` flags hide things that should be
visible.** ⚠️ **D20: `StaffPage` was retired into `TeamPage`, `is_suspended` and `staff_active` are
two booleans for one fact — establish the live state rather than trusting the retirement completed.**

---

## ⚠️ HOW THESE ARE ACTUALLY RUN — SEVEN THREADS, NOT TWELVE (revised 2026-08-30)

**The twelve areas above stay as the map. They are not twelve threads.** Owner, 2026-08-30:
*"why are we running all 12 separately? is there a way to group them based on the model tier? or is
there a real logical reason to make me do 12 separate threads?"* — and *"i cant run something with
mixed model tiers."*

⚠️ **There was no good reason for twelve. The original split was by subject boundary, and nobody
asked what the right BATCH was.** But **model tier is the wrong axis to group on** — it optimises
configuration convenience, not the quality of the sweep. **The axis that matters is whether two areas
share a spine**, because a sweep that can only see half a seam reports half a finding, which is the
exact failure this method exists to end.

**Measured against production, 2026-08-30 — this is what decided the grouping:**

| Evidence | Consequence |
|---|---|
| `contacts` is referenced by **63 tables**; `profiles` by **50** | ⚠️ **Identity is not an area, it is the substrate.** It gets its own sweep and nothing is merged into it |
| `bookings`, `lesson_credits` and `fulfillment_units` **all carry FKs into `purchases` / `purchase_items` / `offerings`** | ⚠️ **A3–A6 are ONE connected component.** Splitting them four ways was the mistake |
| `documents` referenced by **25** tables | contracts are their own spine |
| `horses` referenced by **15**, crossing into `contacts` **9** times | coherent enough to stand alone |

**Two kinds of grouping, and the difference is honest:**
- **MERGED** — the areas share a spine, so the thread produces **ONE report** covering them, because
  a single finding spans them.
- **BATCHED** — the areas are independent; one thread produces **TWO SEPARATE REPORTS**, back to
  back. ⚠️ **The saving is your tab count, not analytic depth — and the brief says so, so no thread
  blends two unrelated areas into one mushy report.**

| # | Sweep | Areas | Kind | Reports |
|---|---|---|---|---|
| **S1** | Identity & access | A1 + A2 | merged | `SWEEP-S1-REPORT.md` |
| **S2** | Orders & money | A3 + A4 | merged | `SWEEP-S2-REPORT.md` |
| **S3** | Scheduling & fulfilment | A5 + A6 | merged | `SWEEP-S3-REPORT.md` |
| **S4** | Contracts & documents | A7 | single | `SWEEP-S4-REPORT.md` |
| **S5** | Horses & the stable | A8 | single | `SWEEP-S5-REPORT.md` |
| **S6** | Delivery & community | A9 + A10 | batched | **two reports** |
| **S7** | Config, kit & barn ops | A11 + A12 | batched | **two reports** |

⚠️ **S2 AND S3 SHARE `purchases` AND MUST BOTH REPORT ON THAT SEAM.** D6 is the documented interface
— `fulfillment_units` are generated from `purchase_items` by `config_kind`. **Each sweep states what
it expects of the other side; ORCH6 reconciles the two statements.** That seam is where the split
was made, and it is the one place a finding could fall between them.

## THE SEVEN PROMPTS

```
SWEEP-S1

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S1 — areas A1 and A2, as one merged report.
```

```
SWEEP-S2

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S2 — areas A3 and A4, as one merged report.
```

```
SWEEP-S3

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S3 — areas A5 and A6, as one merged report.
```

```
SWEEP-S4

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S4 — area A7.
```

```
SWEEP-S5

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S5 — area A8.
```

```
SWEEP-S6

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S6 — areas A9 and A10, as two separate reports.
```

```
SWEEP-S7

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep S7 — areas A11 and A12, as two separate reports.
```

**Worktree `wt-s<n>`, branch `task/s<n>`. Commit the report(s) only. Do not push.**

## CONFIGURATION — one tier per thread

⚠️ **A thread runs at ONE model tier**, so the per-area table that used to sit here was unusable.
**Every sweep is Opus, thinking ON.** The only variable is effort:

| Sweep | Model | Thinking | Effort | Why |
|---|---|---|---|---|
| **S1** Identity & access | Opus | ON | **MAX** | 63-table substrate, RLS across 162 tables, and D30 names this model first for the rebuild |
| **S2** Orders & money | Opus | ON | **MAX** | two locked rulings to build to, and two measured data faults already known |
| **S3** Scheduling & fulfilment | Opus | ON | **HIGH** | the availability inversion is a design decision, not an inventory |
| **S4** Contracts & documents | Opus | ON | **HIGH** | 61+ executed documents are evidence; a live lease is in production |
| **S5** Horses & the stable | Opus | ON | **HIGH** | bounded, with known unfixed defects to confirm |
| **S6** Delivery & community | Opus | ON | **HIGH** | two reports; the anon-read question in A10 is a security decision |
| **S7** Config, kit & barn ops | Opus | ON | **HIGH** | two reports; mostly breadth, but D13/D21 judgement runs through A11 |

⚠️ **Opus throughout is deliberate.** These sweeps exist to find what is not written down — the job
the earlier Sonnet allocation was worst suited to. **Effort is where the dial moves.**

## RUN ORDER

**All seven are read-only, so all seven CAN run at once.** ⚠️ **Do not.** Batch **three, then four** —
the constraint is not contention, it is that ORCH6 has to audit every report against production, and
seven audits at once is where a rubber-stamp creeps in.

**Recommended: S1 · S2 · S3 first** — they are the substrate and the spine, they carry both MAX
sweeps, and the other four all reference their findings. **Then S4 · S5 · S6 · S7.**
