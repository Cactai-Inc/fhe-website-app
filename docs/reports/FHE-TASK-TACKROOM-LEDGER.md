# FHE-TASK-TACKROOM — LEDGER (DISCO profile, read-only research on CR-109)

## RESUME
- **Opened:** 2026-09-02, on `main` at b846b227, clean tree.
- **Subject:** CR-109 — Stable/Tackroom management (Horses · Gear · Supplies · Business, assignment + consumption).
- **Profile:** DISCO (research & capture). Read-only against production. No spec authoring, no build.
- **Status:** ✅ RESEARCH COMPLETE. Handoff written: `docs/reports/FHE-DISCO-TACKROOM-HANDOFF.md`.
- **Next stop:** ORCH — step 3 (discussion & lock) with the owner on the 8 ASK-OWNER items in the handoff §5; then a DSNR-profile task.
- **Nothing written to code or the database.** Two docs only.

## Findings (headline; detail in the handoff)
1. All four barnops tables are EMPTY in production; 0 consumption billable lines; 0 default-payer rules (resolver would raise on first use).
2. `stable_items` 0 rows, `vendors` 0 rows; My Stable "The business" shows 0 of 3 horses (all client-owned). The owner saw three empty lists.
3. Horse-record "supplies" = `horse_medications` (3 rows: Smartpak / equioxx / Adeqon), cost+supplier columns all blank.
4. Consumption NEVER depletes `resource_lots.on_hand` — no trigger, no function. Depletion is unbuilt.
5. No gear→horse assignment, no horse→feed/bedding selection, no per-horse usage read, no "business" bucket exist anywhere.
6. Barn Ops is unseen because MODULES_GROUP is `CARD_PAGE_ONLY` since TASK-FIX3 (2026-08-31); doors left: last row on /app/account, admin dashboard module tile, /app/ops/modules. Registry rows ≠ rail rows; org_page_visibility has 0 rows and is wired to nothing.
7. `src/lib/api.ts` holds a dead duplicate of the barnops wrappers; nothing imports it.
8. `test/db` barnops suites: 19 failed / 10 passed — stale "FHE barnops OFF" premise + snapshot append-only/money assertions. Prod REVOKE verified intact.
9. Three vendor notions (contacts vendor type · `vendors` table · lot vendor contact).
10. `mod.boarding` models FHE as boarding PROVIDER; the owner's "Business › boarding" is a cost FHE pays — inversion to rule on.

## Corrections to the record
- CR-109 routing note: "machinery already exists" is true of schema, false of behaviour.
- TASK-DUPECENSUS-REPORT "mod.barnops disabled" — stale since 2026-08-12.
- DB-MAP resolver callers — api.ts is dead. SURFACE-INVENTORY barnops NAV citation — stale since FIX3.

## Queries run (all read-only, 2026-09-02, prod)
counts on resources / resource_lots / consumption_events / cost_allocation_rules / billable_lines(source_kind) / stable_items / vendors / horses / horse_medications / org_page_visibility / org_modules; horse owners vs company contact; horse_relationships rows; pg_policies + role_table_grants on the six tables; pg_trigger on consumption_events + resource_lots; pg_proc prosrc scans for horse_parties / on_hand / cost_allocation_rules; column lists for horses / stable_items / horse_medications / org_page_visibility.

## TEARDOWN
- Background vitest run finished (exit 1, results recorded). No servers, no watchers left running.
