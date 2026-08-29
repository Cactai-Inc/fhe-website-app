# ZONE SWEEPS A1–A12 — twelve briefs, drafted 2026-08-29

⚠️ **DRAFTED, NOT LAUNCHED.** These run **after** ORCH6 has landed the fixes from the `TASK-AR*`
admin review. Launching them before those fixes means twelve sweeps reporting defects that are
already being repaired.

**Every sweep reads, in this order:**
1. **`docs/METHOD-area-sweeps.md`** — the directive, the five-part deliverable, the concurrency rule.
2. **`docs/tasks/ADMIN-REVIEW-ANALYSIS-STANDARD.md`** — the depth requirement and the state matrix.
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
⚠️ **The messaging A or B is still the owner's to choose** — see `docs/handoff/04-OPEN-QUESTIONS.md`.
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

## THE TWELVE PROMPTS

**Each is two lines. Model and effort are stated outside the block so the block stays copyable.**

```
SWEEP-A1

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/ZONE-SWEEPS-A1-A12.md and sweep area A1.
```
*(…identical for A2 … A12, changing only the identifier on line 1 and the area on line 3.)*

**Model and effort, per area — judgement-heavy areas get Opus:**

| Area | Model | Effort | Why |
|---|---|---|---|
| **A1 Identity** · **A2 Access** · **A3 Order spine** · **A4 Money** · **A7 Contracts** | **Opus** | HIGH | model-level judgement, locked rulings to build to, and the highest cost of being wrong |
| **A5 Scheduling** | **Opus** | HIGH | the availability inversion is a design decision, not an inventory |
| **A6 Fulfilment** · **A8 Horses** · **A10 Community** | **Opus** | MEDIUM | real judgement, smaller blast radius |
| **A9 Notifications** · **A11 Admin config** · **A12 Barn ops** | **Sonnet** | HIGH | mechanical breadth with the traps already written out |

**Thinking: ON for all twelve.**
