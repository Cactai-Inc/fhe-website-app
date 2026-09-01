# OWNER DECISIONS PENDING — 2026-08-20

**Written by the FHE orchestrator (ORCH3) for the owner, and bundled as a note for the Claude
chat thread reviewing this repo.** Every item is a decision **only the owner can make** — a
business, legal or product ruling, not a technical choice an engineer should settle alone.

**Each carries the orchestrator's recommendation**, so the owner can answer with a yes rather
than a design session. Where a recommendation exists, it is reasoned from measured state, and the
source document is cited so a reviewer can check it rather than trust it.

**Already ruled and NOT open** (recorded here so nobody re-asks): the lease end date is
*"Evergreen yes"* and shipped as presentation; a single care service **does** mint one
offering-tagged credit (ruled 2026-08-16, live and proven). Both were closed by `TASK-CLOSEOUT`.

---

# BLOCKING RIGHT NOW

## 1. The D19 bar — how strict, and does it apply everywhere?

**The biggest open decision, and the newest.** `TASK-REACHAUDIT` (merged `d138017`) found that of
~50 pages performing a real mutation, the overwhelming majority score **N on all four** D19 flags:
no confirmation, no reason captured, no reference recorded, no undo. **Exactly two surfaces in the
whole app pass — `ContractPage` and `DealPage`.** Source: `docs/reports/TASK-REACHAUDIT-REPORT.md`
§4 F3; per-page scoring in `docs/reference/SURFACE-INVENTORY.md`.

**No rebuild can be specced until the bar is set.**

**Recommendation — tiered, not universal:**
- **All four** for anything moving money, credits, documents, or a person's status.
- **Confirmation only** for reversible configuration edits (renaming a resource, toggling a page).
  Demanding a written reason to rename a paddock will make staff hate the app.
- **Extract the standard from `ContractPage`/`DealPage`, do not invent it on `LessonCreditsPage`.**
  Two working references already exist in this codebase; copying beats designing.

## 2. What IS a mixed inquiry, for filing and filtering?

A cart spanning categories is filed under whichever funnel the visitor happened to stand in, so
staff filters under-count. Verified still true at `8186b47`. Live rows: `general 9 · lessons 6`.
Source: `TASK-CLOSEOUT-REPORT.md` §3.3.

Options the data supports: (a) add a `mixed` category value · (b) one request per category sharing
a thread id · (c) keep one request and derive filter membership from its **order lines**.

**Recommendation: (c).** The order lines already know what is in the inquiry, it needs no schema
change, and a derived filter cannot under-count. CLOSEOUT independently recommends the same.

## 3. May `record_signature` stop accepting anonymous calls?

For contract-engine documents, **provided the kiosk release flow keeps its own door.** A security
boundary, raised under an active signing freeze. Source: `TASK-CLOSEOUT-REPORT.md` F-NEW-1.

**Recommendation: yes** — the kiosk keeps its door; everything else requires a session.

## 4. DEPENDENT — four questions about minors

Not hypothetical: **Gabriella Olenik is a real 13-year-old currently recorded as the purchaser of
her own lessons.** Source: `TASK-DEPENDENT`, `docs/OPEN-ITEMS-2026-08-18.md` §2.

1. May a guardian spend their own credit on a child?
2. May siblings share an entitlement?
3. Does Brian get his own account?
4. What happens when a minor turns 18?

**No recommendation offered — these are partly legal, and inventing them would be wrong.**

---

# BLOCKING THE PHASE AFTER

## 5. Rebuild order — which area first

**Recommendation: the booking/credits area, not Records.** The previous orchestrator recommended
Records first because it has almost no CRUD. But Records is *missing* function, while credits is
*actively corrupting* the ledger every time staff use it (D18: a second write path beside a correct
engine; the granted credit that never expires). **Missing is cheaper to live with than wrong.**

## 6. Monthly billing — four sub-questions

Blocks building any biller at all. Source: `MONTHLY-BILLING-REVIEW.md`.
The exact review day · do invoices send if nobody reviews · who is notified · does the client see
anything at review time.

## 7. The two pricing algorithms — ✅ RULED 2026-08-20, and the ruling changes the task

> **Owner, 2026-08-20:** *"pricing algorithms should have an editor to construct them built into
> the app, not hard coded into the app via working with you."*

**This is no longer a design question, it is a build instruction — and it inverts the task.**
The old framing (the owner designs two formulas, a thread hardcodes them) is refused. **The
deliverable is an ALGORITHM EDITOR**: the owner constructs, edits and re-edits the finder and
assistance pricing rules himself, in the app, with no thread, no SQL and no git.

**Consequence:** the two algorithms stop being a blocker on any other work. Nothing waits on the
owner designing them, because designing them is something he does in the product afterwards, as
many times as he likes. Recorded as **D21** in `CLAUDE.md`.

**Not yet specced.** Open sub-questions the spec must answer: what primitives the editor exposes
(bands, tiers, multipliers, floors/ceilings, rounding), whether a rule can be previewed against a
worked example before publishing, and whether pricing rules use D12's shared draft/publish/version
lifecycle — **recommendation: yes, they should**, because a mispriced published rule needs the
same rollback story a template does.

---

# SMALL — mostly a yes/no

| # | decision | note |
|---|---|---|
| 8 | Fix the dead CTA on the horse-care dashboard | `CareHome.tsx:70` links to `/horse-care`, which is not a route; the real one is `/horse`. Clients hit a 404 today. One word — **but it is code, so it deploys.** |
| 9 | Should suspending a whole tenant require a confirmation? | `TenantDetailPage` suspends a tenant or flips its modules with no `confirm()`. Superadmin-only, so the severity call is the owner's. |
| 10 | Are the **nine** `INTAKE_HORSE_*` forms the fulfilment forms? | CLOSEOUT found **nine, not five**, all active, created 2026-07-02 — and **no end-user surface renders any of them.** |
| 11 | What does a Party see after signing? | They get a login, a stable, and no relationship. Source: `PARTYROLE`. |
| 12 | Footer — the Cactai URL, and the light map tiles against the dark footer | Cosmetic. |
| 13 | Rename the tracker product's `orchestration/orch3.md` | It collides with the FHE orchestrator's name. Suggested: `TRACKER-SPAWN.md`. The tracker build is **paused by the owner's own instruction** and nothing here changes that. |

---

# STILL OUTSTANDING — the owner's own list

**Step 3 of the owner's three-step plan** (`docs/archive/HANDOFF-ORCH3.md` §3) is reviewing the items on
his own list. **He has not supplied it, and it is the only input that cannot be derived from the
code.** It is not written down anywhere in this repo.

---

# WHERE THE PLAN STANDS

- **Step 1 — `TASK-CLOSEOUT`: DONE**, merged `7486172`. Lease-flow gates, horse-document timing,
  deal/contract status coupling, notification log, plus a 40-step ordered retest walk
  (`docs/reports/RETEST-CHECKLIST.md`) replacing seven overlapping checklists.
- **Step 2 — two halves.** `TASK-REACHAUDIT`: **DONE**, merged `d138017` →
  `docs/reference/SURFACE-INVENTORY.md`, all 128 routes. `TASK-FLOWMAP`: **SPECCED, NOT RUN** —
  `docs/tasks/TASK-FLOWMAP-every-flow-the-app-facilitates.md`. ⚠️ **No flow map output exists yet.**
- **Step 3 — awaiting the owner's list.**
