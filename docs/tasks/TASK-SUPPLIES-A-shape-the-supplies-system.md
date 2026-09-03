# TASK-SUPPLIES-A — shape the supplies system (DSNR profile: specs + chunk declaration, no build)

**Thread:** `FHE-TASK-SUPPLIES-A` · **Profile:** `DSNR` (`docs/method/DSNR-ROLE.md` binds you; `docs/method/TASK-ROLE.md` first) · **Model:** Fable 5.1 · effort HIGH · **Worktree:** `wt-4` · branch `task/supplies-a` from `origin/main` · **Sender / hand back to:** `FHE-MGMT-SUPPLIES` · **Bundle:** `docs/orch/BUNDLE-SUPPLIES.md` (B5). Dispatched by MGMT 2026-09-03.

**Zeroth act:** the CLNR pass (`docs/method/CLNR-ROLE.md` §3) — one line if clean. **D36 guard, same turn as the claim:** `wt-4` must be detached with empty porcelain; then `git fetch origin && git checkout -b task/supplies-a origin/main` and `git clean -xdf -e node_modules -e .env -e .env.db`. **Open `docs/reports/FHE-TASK-SUPPLIES-A-LEDGER.md` as your first write and keep its RESUME block current.**

**READ-ONLY against production** (connection string: line 1 of `.env.db`). You measure; you never write a row. No code. No migration. No subagents.

---

## 1. WHAT THIS TASK PRODUCES
1. **A spec SET** in `docs/tasks/TASK-SUPPLIES-<LETTER>-<slug>.md` — letters from **B** onward (**A** is you; **V** and **W** are reserved for the verifier and the walk). Expect 4–7. Anatomy: `DSNR-ROLE.md` §4, every section, including THE SHAPE for anything a member or client will see.
2. **The handoff** `docs/reports/FHE-DSNR-SUPPLIES-HANDOFF.md` per `DSNR-ROLE.md` §5 — **plus** §6 below (the escalation evidence) and §7 (the B7 contract).
3. **The chunk declaration**: per chunk, the files, routes, DB objects (tables · functions · triggers · policies) it OWNS; what must merge before it; **which chunks are DISJOINT and may build in parallel** — that declaration is yours (architecture), MGMT only splits/merges for contention.
4. `docs/reports/TASK-SUPPLIES-A-REPORT.md` (`TASK-ROLE.md` §6) and your ledger.

You do not build. You do not talk to the owner — questions go in the handoff as ASK-OWNER (most-blocking first) and MGMT summons him **once, batched**.

## 2. READ, IN THIS ORDER — the design is RULED, not open
1. `docs/orch/BUNDLE-SUPPLIES.md` — the items, the OWNERSHIP DECLARATION (§4 below), the escalation points, the merge lane.
2. `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-109, §CR-112, §CR-112·A1, §CR-112·A2 (verbatim owner design and answers — **these are the requirements**), then §CR-110, §CR-111 (+A1), §CR-114, and §CR-86's four 2026-08-31 sub-entries (how a comp is recorded · the cost cadences · the simplification · WHERE EACH PART LIVES) — CR-86 gap 3 folds into this bundle.
3. `docs/reports/FHE-DISCO-TACKROOM-HANDOFF.md` — the measured inventory (2026-09-02) and its §5 rulings, most now answered by CR-112/A1/A2. Its §8 lists the files.
4. `CLAUDE.md` — D13, D17, D18, D19, D21, D32, D35, D36, D39, D41, D43 (+CR-111 banned words), D44.
5. `docs/reference/MODEL-CHOICE-NOTES-2026-09-01.md` §2026-09-03 — why this is a Fable task: **the question is the SHAPE**. Give the build threads the outcome, the incumbent, the rulings and the traps; do not write a prescriptive route where the shape is what matters.
6. Memory-class traps recorded in the repo: `docs/reference/FLOW-MAP.md` §1 (F5, F10, F13, F14, F17 are the flows this bundle touches), `docs/design/DASHBOARDS-GROUND-UP-PLAN.md` §5/§7 (the zone framework; D13's self-arranging exception).

## 3. THE OUTCOME, in one paragraph (the ledger has the detail — do not paraphrase it into the specs, QUOTE it)
One ledger spine per door (events: received · used · counted/adjusted · expense · scheduled), lot-level FIFO cost with cost recognised at purchase, two entry types (+inventory/+expense · −inventory/+expense), a per-door Ledger surface, and the nested structure **My Stable → My Horses / My Tackroom → Supplies · Property** with roll-up from inner to outer. The horse record gets ONE unified consumption card (our-supplied + client-supplied), the boarding fee as a recurring cost on the horse, orders gain a HORSE attribution, and the KEPT resolver (`resolve_consumption_billing` + `cost_allocation_rules`) becomes the lease expense-sharing engine seeded from contract terms. Recurring fixed costs post on the 1st (tackroom rent, insurances, car, phone, internet; utilities manual). Assignments with monthly rates, an audit surface, projections, deviations, and per-account dashboards — the last three CONSUME B7's global machinery (§7). CR-110: the Account page becomes THE access point for modules. CR-111: "Barn Ops" retires; "Property" is the durable-goods door; the internal facility term in `src/lib/propertyTerm.ts` is renamed so the two never meet.

## 4. THE OWNERSHIP BOUNDARY — copy it into every spec's "what you own / what you must not touch"
From `BUNDLE-SUPPLIES.md` §Ownership: **DB** `resources` · `resource_lots` · `consumption_events` · `cost_allocation_rules` · `resolve_consumption_billing` · `billable_lines` (consumption source only) · `stable_items` · `vendors` · `horse_medications` (fold-in) · every NEW object the design needs · `purchases`/`purchase_items` ONLY the new horse-attribution column and its writer (**declare the exact column in the spec before any task applies it**). **Files** `src/pages/app/ops/barnops/**` · `src/pages/app/ops/hubs/BarnopsHubPage.tsx` · `/app/stable` pages + `src/lib/stable*` · `src/lib/ops/api-barnops.ts` (+ the dead copy in `src/lib/api.ts`, retired not deleted) · `src/pages/app/AccountHub.tsx` (access-point rows) · the horse record's new card · `src/lib/propertyTerm.ts` · `pageRegistry.ts` rows for these pages.
⚠️ **NOT ours:** the global dashboard-config / element-config / report machinery (B7 DASHBOARDS) · `AppLayout.tsx` nav (B10) · editors' version spine (B8). **A shape that needs a file or DB object outside this list is NOT specced around silently — it is named in the handoff as an escalation for MGMT to take to ORCH, with what it needs and why.** Two bundles in one function is D35.

## 5. FACTS TO RE-MEASURE BEFORE YOU WRITE (D20 — every number in a spec carries the query you ran today)
- TACKROOM's counts (all barnops tables 0 · `stable_items` 0 · `vendors` 0 · `horse_medications` 3 · 0 `default`-scope allocation rules · consumption never depletes `on_hand`). Re-run them; note that RECONCILE re-measured on 2026-09-02.
- ⚠️ **CR-110's "a single parked NavRow for Barn Ops" is STALE.** MGMT read `AccountHub.tsx` on 2026-09-03: **three** module rows render for staff — Boarding, Barn Ops, Employees — each gated by `hasModule()`, in the block that FIX3's comment describes. Measure the block and write CR-110's spec against what is there.
- `src/lib/propertyTerm.ts` — count its consumers by rendered element (`usePropertyTerm`, `withArticle`, `withPreposition`, `DEFAULT_PROPERTY_TERM`), not by import path (a barrel hides adopters). The rename is a chunk of its own or rides with the door-naming chunk — your call, said aloud.
- `test/db/mod_barnops.test.ts` + `e2e_consumption.test.ts`: 19 failed / 10 passed on 2026-09-02; `test:db` proves nothing at baseline. Say in the specs which assertions a build must revive and which stay red-by-design.
- The three vendor notions (contacts vendor type · `vendors` table · `resource_lots.vendor_contact_id`) — the spec converges or says why not (D18).
- `lookup_options` / managed-options: the incumbent for owner-editable vocabularies (units, categories, attribution types, brands/product names). ⚠️ **Adding a new vocabulary KEY is allowlisted in three places** (repo memory, 2026-08-27: a new key is only half-editable until all three allowlists are widened) — find them and name them in the chunk that seeds a vocabulary. D13: seeding through a migration with no editor is the pattern that decision exists to stop.
- `purchases`/`purchase_items` columns today, and the order → `billable_lines` → payment path (F10) the horse attribution must ride, not duplicate (D18).
- `horse_relationships.share_pct` and the lease template's expense-sharing terms (which token/clause carries the split) — the resolver's seed source per A2.

## 6. THE ESCALATION EVIDENCE — one section each in the handoff, in this shape: *what exists today · the diff · recommendation*
The bundle pre-registered five points; MGMT summons the owner once with all five after your handoff. Your job is to make each cheap and final:
1. **The Gear page's shape** — what `stable_items` kind=gear holds and renders today (fields, editors, the `owner_kind` toggle), versus gear as +inventory items of kind gear on the ledger spine; the diff in tables, surfaces, and what a member loses/gains. Recommend.
2. **Client-side Supplies page timing** — CR-112·A1 §10 flags client REPORTS; is the client Supplies PAGE flagged too or live from first build? Prepare: what a client sees at first build under each answer, and the flag mechanism the app already has (`org_modules`? a feature flag idiom? name the incumbent).
3. **The billing lane** — the one-paragraph flow: usage event → resolver-computed split (leased horse, contract terms) → order line at unit price as the resolver's OUTPUT ("billed separately"); versus bundled supply inside the care-service cost. Confirm the resolver computes and the order line consumes; name the function boundary.
4. **Units vocabulary** — propose the preset list (lb, kg, oz, g, bale, bag, flake, scoop, ml, l, gal, dose, tablet, tube, each, …) with the conversion families that make "$/bag ÷ 50 = $/lb × 12" work, and the editor surface (D13).
5. **Attribution vocabulary seed** — Headquarters · Stalls · Tackroom · Horse · Event · Activity · Client (+ ranch / a named arena as locations); how each maps to a real record where one exists (horses, contacts, `facilities`/stalls, events) and to free-text pairs where it does not (CR-112 §4 two-step selection with "manual entry"). Propose; he confirms.
6. Anything CR-112/A1/A2 cannot settle — ASK-OWNER, batched, each with a recommendation.

⚠️ **A known gap in the requirements:** CR-112·A1's "Ledger answers: 1 approved · 2 approved · 5 approved · 6 agreed · 8 correct" refer to ORCH's numbered suggestions list from the ORCH thread of 2026-09-03, which **is not in any file** (grep 2026-09-03: only the ledger mentions it). MGMT has asked ORCH to record it. **If it lands in the ledger before you finish, fold it. If not, author from the verbatim text and mark every place a spec leans on an approved-but-unrecorded item as `INHERITED-UNKNOWN` with your reading of what it must have been — listed in the handoff's ASK section so the batch to the owner closes it.**

## 7. THE B7 CONTRACT — dashboards, projections, deviations, reports are CONSUMERS
The global dashboard-config / element-config / report engine (CR-112·A1 §11–12) is **B7 DASHBOARDS'**, not this bundle's. For the supplies dashboard, projections, deviations, per-account provisioning and the monthly report: spec them as consumers of an engine that does not exist yet — write the **interface this bundle needs** (element registration, data-source shape, per-account config, the "monthly report" trigger, the documents-page sink) as its own section of the handoff, mark those chunks **GATED ON B7's merge**, and keep the ledger/spine/surfaces chunks buildable without it. MGMT stops the gated chunks and reports up if B7 has not merged when they are reached. The **audit surface** (start-audit, guided count, expected vs actual, ledger captures the metadata) is a ledger event type and a surface of ours — not gated.

## 8. STANDARDS THIS BUNDLE SETS — say so in the spec that sets each
- **CR-114:** the first main→sub-page navigation (buttons on desktop, dropdown on mobile) is set HERE. Spec it as one reusable element with the incumbent named (whatever `OpsHome`/hub pages use today), so B10's audit adopts it. MGMT reports the pattern up.
- **CR-111 / D43:** no "Barn", "Stable" (except "My Stable"), "Program", etc. in any new name, route label, registry title or copy. Business-sense references use "French Heritage Equestrian".
- **D19 on every ledger entry:** states itself before it writes, records why, is reversible — `consumption_events` is APPEND-ONLY by design (UPDATE/DELETE revoked): reversal is a counter-entry, and the spec says how the surface shows it.
- **D32:** "removed" rows are HIDDEN, never deleted; hidden items surface in a "hidden items" section (CR-112 §2). The three `horse_medications` rows survive whatever Supplies becomes.
- **D13/D21:** every vocabulary, rate, formula (FIFO is the ruled costing; reorder trigger thresholds; monthly rates; the recurring-cost schedule) is owner-editable in-app or the spec names the follow-up that ships the editor. A hardcoded business formula is a defect by default.
- **D17/D39, THE REACH and THE TELL:** for every surface — what a person clicks, from which page; for every captured value — where it is seen and where it is acted on. The horse record card and a client's Supplies page are guest/member-facing: **produce THE SHAPE** (states, each audience, empty case, error case) and flag in the handoff that the owner must see it before build (DSNR-ROLE §4 last block; the bundle's Gates to ORCH).

## 9. TRAPS, named (from the repo's own record — cite the source in the spec that inherits each)
- **DROP+CREATE / a fresh function re-grants `anon`/`authenticated` EXECUTE via Supabase default privileges; `REVOKE FROM PUBLIC` alone is insufficient** (CLAUDE.md, TASK-BOOKS1/ORIGIN). Every new RPC's spec carries the explicit REVOKE from `anon` by name and a `pg_proc.proacl` proof.
- **`UPDATE OF <col>` fires on the columns the STATEMENT names** (ORCHESTRATOR.md §3c). Any depletion/roll-up trigger spec proves the firing statement.
- **`CREATE OR REPLACE` with a new defaulted parameter overloads** — drop the old signature.
- **Supabase errors are not `Error` instances** — `instanceof Error` kills every machine-code branch (TASK-ERRSWEEP); the surfaces use `useAsync.ts`.
- **A component defined inside another component eats one keystroke per render** — hoist to module scope (repo memory, 2026-08-25).
- **RLS was the real "can't reach" bug more than once** (TASK-AUTHORITY): every new table's spec states its policies and the org boundary, and the test that proves a client cannot read the business's ledger.
- **The resolver raises with no `default`-scope payer** — the spec says who seeds it and where it is edited.
- **`resolve_consumption_billing` writes `billable_lines`** — the F10 payment spine consumes those; do not build a second money path (D18).
- **The month-roll cadence**: A1 wants monthly, not month-to-date; the only cron that has ever fired is the hourly GitHub Actions job (`.github/workflows/scheduled-jobs.yml`, AR1). Recurring costs "on the 1st" ride that job or a DB scheduler that exists — name which, measured.
- **TASK-CATEGORISE / NOSTRIP precedent:** additive changes are safe mid-walk; subtractive are not — the My Stable reshuffle is coursed as ONE unit (bundle merge lane), so the chunk declaration must make that unit buildable in parallel and mergeable together.

## 10. CHUNKING GUIDANCE (yours to decide; MGMT's expectation, not a prescription)
A likely partition — challenge it: **(a)** the ledger spine + FIFO lots + entry types + hidden-not-deleted + vocabularies with editors; **(b)** the door reshuffle (My Stable → Horses / Tackroom → Supplies · Property) + CR-114 sub-nav + CR-111 naming + `propertyTerm` rename + CR-110 access-point rows; **(c)** the horse record card + boarding fee + client-supplied entries + orders' horse attribution + resolver seeding from lease terms; **(d)** recurring costs + audit surface; **(e)** B7-gated: dashboard/projections/deviations/report consumers. Say per chunk why it is one and not two, what merges first, and which pairs are disjoint by DB object and by file.

## 11. MODEL AND EFFORT PER CHUNK — recommend in the handoff (MGMT decides)
Default CODR: Opus · HIGH · thinking ON. Sonnet only for a pure idiom sweep (e.g. the banned-word/name rename if it is mechanical). VRFY: Opus · HIGH · ON with production queries on the ledger math (FIFO cost, on-hand derivation, idempotent recompute) — write THE TEST so a verifier can re-run every claim.

## 12. NON-NEGOTIABLES
Read-only against production · never `~/Desktop` · delete nothing · stage explicit paths · commit as you go on `task/supplies-a` · **do not push** · no subagents · TEARDOWN census at the end. Touch only `docs/tasks/TASK-SUPPLIES-*.md`, `docs/reports/FHE-DSNR-SUPPLIES-HANDOFF.md`, `docs/reports/FHE-TASK-SUPPLIES-A-LEDGER.md`, `docs/reports/TASK-SUPPLIES-A-REPORT.md`.

## 13. CLOSE (TASK-ROLE.md §5b)
```
Done. Report at docs/reports/TASK-SUPPLIES-A-REPORT.md
Hand this back to FHE-MGMT-SUPPLIES
```
If you are STOPPING ON A QUESTION, say the question in one or two lines instead — MGMT routes it.
