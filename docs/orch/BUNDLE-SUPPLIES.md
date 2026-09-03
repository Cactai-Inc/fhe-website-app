# BUNDLE-SUPPLIES — B5 (cut by ORCH, 2026-09-03; RECONCILED-2026-09-02.md §8 row B5)

**Sender: hand everything back to `FHE-ORCH-7`.** Bundle tree: `wt-3`. Task trees allotted: `wt-4`,
`wt-5`, `wt-6` (ask ORCH for more; the pool grows on demand).

## Read first, in this order — the design is RULED, not open
1. `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-109, §CR-112, §CR-112·A1 (+ THE PROPOSED LIST), §CR-112·A2, §CR-112·A3 — the owner's
   design, verbatim, and his answers. **These are the requirements.**
2. `docs/reports/FHE-DISCO-TACKROOM-HANDOFF.md` — the measured inventory of what exists (all
   barnops tables EMPTY; depletion unbuilt; three vendor notions; why the pages are unseen), plus its
   §5 rulings — most now answered in CR-112·A1/A2; the rest are escalation points below.
3. `CLAUDE.md` D43 (+CR-111: banned words incl. "Barn"/"Stable" except "My Stable"), D18, D19, D32,
   D39, D13/D21 (owner-editable content and formulas), D35/D36.
4. `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-110 — the modules access point (Account page).
5. `docs/reference/MODEL-CHOICE-NOTES-2026-09-01.md` §2026-09-03 — why this bundle's design task is Fable.

## The items, with state
| # | Item | State |
|---|---|---|
| 1 | **The supplies system** per CR-112/A1/A2: ONE ledger spine (events: received · used · counted/adjusted · expense · scheduled), lot-level FIFO cost, cost recognized at purchase, two entry types (+inventory/+expense, −inventory/+expense), per-door Ledger surface, the nested structure My Stable → My Horses / My Tackroom → Supplies · Property; assignments with monthly rates; audit surface; projections; deviations; per-account dashboards | DISCO facts exist (TACKROOM); **DSNR spec needed (Fable)** |
| 2 | The horse record's unified consumption card (ours + client-supplied), boarding fee as a recurring cost on the horse, orders gain a HORSE attribution, the KEPT resolver becomes the lease expense-sharing engine seeded from contract terms | in item 1's spec |
| 3 | Recurring cost schedule (rent, insurance, car, phone, internet — posted on the 1st; utilities manual) — ORCH's suggestion, owner: "if both of these are proper solutions, proceed" | in item 1's spec |
| 4 | **CR-110** — the account settings page as THE access point for modules (the parked Barn Ops row is a stub) | facts known; spec needed |
| 5 | Door/module naming under CR-111: "Barn Ops" retires; "Property" is the owner's name for durable goods — the INTERNAL facility term is also "property" (`src/lib/propertyTerm.ts`) and must be renamed in code so the two never meet | in item 1's spec |
| 6 | CR-86 gap 3 — the monthly cost sheet on the horse record (old item; per-event cost tables stay UNDRIVEN per D32) | folds into item 2 |

## Ownership declaration (D35/D36) — this bundle holds:
- **DB:** `resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` ·
  `resolve_consumption_billing` · `billable_lines` (consumption source) · `stable_items` · `vendors`
  · `horse_medications` (fold-in) · every NEW table/function the ledger, assignments, audits,
  recurring costs and projections need · `purchases`/`purchase_items` ONLY for the new horse
  attribution column and its writer (declare the exact column before applying).
- **Files:** the new Admin **Company** and **Accounting** (Assets · Expenses) pages (CR-112·A3) · `src/pages/app/ops/barnops/**` · `src/pages/app/ops/hubs/BarnopsHubPage.tsx` ·
  `/app/stable` pages and `src/lib/stable*` · `src/lib/ops/api-barnops.ts` (+ the dead copy in
  `src/lib/api.ts`, retired not deleted) · `src/pages/app/AccountHub.tsx` (the access-point rows) ·
  the horse record page's new card · `src/lib/propertyTerm.ts` (rename of the internal term) ·
  `pageRegistry.ts` rows for these pages.
- **NOT this bundle's:** the GLOBAL dashboard-config / element-config / report machinery (CR-112
  §11–12) — that is **B7 DASHBOARDS**. This bundle's supplies dashboard and report tasks CONSUME
  B7's engine: spec them against B7's contract and gate their build on B7's merge; if B7 has not
  merged when you reach them, STOP those tasks and report up. `AppLayout.tsx` nav is B10's.
- **Trees:** `wt-3` (MGMT) · `wt-4`/`wt-5`/`wt-6` (tasks).

## Pre-registered escalation points (the only summons) — each with what to put in front of him
1. **The Gear page's shape** under the new structure (it exists; does it join the ledger spine as
   +inventory items of kind gear, or stay a plain list?). Prepare: what it holds today, the diff.
2. **Client-side Supplies page timing** — CR-112·A1 §10 says client reports behind a feature flag;
   is the client Supplies PAGE itself flagged too, or live from the first build?
3. **Billing lane** — resolver-driven split for leased horses vs order lines at unit price for
   "billed separately": the owner chose to KEEP the resolver; confirm the split is resolver-computed
   and the order line is its output (prepare the one-paragraph flow).
4. **Units vocabulary** — the preset measurement-unit list (lb, kg, bale, bag, flake, scoop, ml, oz,
   dose, each…): propose the list; he edits (D13: it must be owner-editable in-app).
5. **Attribution vocabulary seed** — Headquarters · Stalls · Tackroom · Horse · Event · Activity ·
   Client (+ ranch/arena as locations): propose the seed; he confirms.
6. Anything the spec cannot resolve from CR-112/A1/A2 — ask ONCE, batched, with a recommendation.

## Gates to ORCH
- **Guest/member-facing surfaces** (a client's Supplies page; the horse record card) go UP before
  merge with the render checklist — the owner sees anything a guest sees.
- **A standard being set:** the first main→sub-page navigation (buttons desktop / dropdown mobile,
  CR-114) is set HERE; report the pattern up so B10's audit adopts it.

## Merge lane
**Course the My Stable door reshuffle + its first sub-pages as ONE unit** (the owner sees one new
structure, not a door to empty rooms). Ledger/spine migrations may merge per task after VRFY.

## Sequence inside the bundle
DSNR (Fable · HIGH — the SHAPE: spec set + disjoint chunk declaration; expect 4–7 specs) → CODR
tasks (Opus · HIGH · ON; Sonnet only for pure idiom sweeps) in parallel where DSNR declared disjoint
→ VRFY per merge (Opus · HIGH · ON; production queries on the ledger math: FIFO cost, on-hand
derivation, idempotent recompute) → WALKR at close: the horse-record flow, the My Stable flow, an
order with a horse attribution, a leased-horse split (FLOW-MAP names; use the WALKTEST fixture
precedent, never a real client).

## Suggested model/effort — SUGGESTIONS ONLY (D45): MGMT evaluates each task's work and decides, stating why
DSNR: Fable · HIGH suggested (the shape question is real). MGMT decides (D45). CODR: Opus · HIGH · ON. VRFY: Opus · HIGH · ON. WALKR: Opus · HIGH · ON.
