# BUILD SEQUENCE + RULINGS NEEDED — 2026-08-20

Companion to 01 (system), 02 (IA/tree), 03 (flows). Waves are sized as single-thread task units;
nothing in a wave depends on a later wave; every wave ends browser-walkable by the owner.

---

## The sequence

**Wave 0 — foundations (nothing visible changes yet)**
- 0a. TASK-AUTHORITY (already specced, two rulings agreed): booking owner authority + credit
  write-path removal + audit coverage. Runs first because every Schedule surface builds on it.
- 0b. The primitive kit: `src/ui/` per 01-DESIGN-SYSTEM §4 — Page, Section, CardGrid, FormGrid,
  Toolbar, Table v2, RecordList, DetailDrawer, Commit, StatusChip, LedgerList, states, Toast.
  Kit incumbents (DataTable/Modal/FormField/EmptyState) generalize in, never duplicated.
- 0c. The fhe-ui skill (`.claude/skills/fhe-ui/SKILL.md`) + lint rules (no arbitrary values, no
  raw writes outside lib, vocabulary-bound status). One thread, mechanical.
- 0d. Raw-write triage sheet: all 76 raw-write functions classified engine-RPC / blessed / dead.
  Authoring input for every later wave; no code change itself.

**Wave 1 — Schedule (the daily spine)**
- Calendar rebuild (full-day rendering, labeled items, interactive month, availability as
  background), Bookings list (rename from Sessions, complete/decline via Commit), availability
  settings. Exit test: a booking at any hour is reachable in every view; a decline notifies;
  completion debits via engine; zero "Booking" labels.

**Wave 2 — Today + People**
- Today dashboard exposed with needs-attention queue (incl. kiosk/inbound seams — F2/F3 fix);
  Records tabs to CRUD standard; contact dossier + Timeline (X3). Exit: "what does this client
  see" answered on any person in two clicks.

**Wave 3 — Money**
- Payment review to Commit; Purchases list; Credits read-only ledger; Obligations home;
  Evaluations moves in; Packages CRUD. Alongside: the owner-run rail proofs the flow map demands
  (X1 cron check in Vercel dashboard; X2 one real paid purchase end-to-end; first proven
  client-facing email). These are verifications, not builds, and they de-risk everything after.

**Wave 4 — Documents & Deals convert**
- ContractPage/DealPage/queue/new-contract re-skinned to primitives, flows untouched; viewer
  renderer merged. ClauseDocument remains stop-and-propose.

**Wave 5 — Member side**
- Home consolidation (Care/Deal cards, dead link dies), My Schedule merge, My Lessons, Orders &
  payments rebuild (buyer payment view), Documents, Stable, Gifts exposed, app catalog/checkout
  rebuild.

**Wave 6 — Operations + Settings**
- Boarding/Barn Ops/Employees to standard (D20 one-roster lands here if not already);
  Settings group flattened; D21 pricing-rule editor (its own spec — the largest single new build).

**Wave 7 — Sweep**
- Review teardown (pending ruling), dead files (Admin.tsx), /book/rider retirement (ruling),
  naming sweep, superadmin Commit, kiosk re-skin, re-run REACHAUDIT and publish
  SURFACE-INVENTORY v2 — the acceptance test for the whole program: zero orphans, zero URL-only
  operational surfaces, zero raw-write mutations without a blessing.

---

## Rulings I need from you (discrepancies + open calls surfaced, not decided)

1. TASK-AUTHORITY vs the prompt's "database is FIXED." The bundle's prompt forbids touching the
   DB; AUTHORITY is schema-integrity migrations we already agreed (backfill, derive trigger, audit
   coverage, orphan void). I read "fixed" as "don't redesign engines," not "no integrity fixes."
   Also: the bundle (audited 8/19–20) still shows the credit raw-write live and no D-rule for our
   two rulings — confirm AUTHORITY is queued as Wave 0a and hasn't already run.
2. D19 bar (pending decisions #1): I adopted the tiered recommendation (all four for value-moving,
   confirm-only for reversible config, none for additive content) and built Commit around it.
   Say yes or adjust tiers.
3. Review section teardown (W13 says separate decision): the tree retires all five routes.
   The contact-dossier mount writes to a real production contact today — I want that one retired
   in Wave 0 regardless of the rest.
4. /book/rider: retire (orphaned, contradicts your no-questions-page ruling)?
5. Evaluations move Community → Money (flow-map F11 taxonomy finding). Yes/no.
6. Mixed inquiry (pending #2): I assumed option c (derive filters from order lines). Confirm.
7. Sessions → Bookings rename, and the area names themselves: Today · Schedule · People · Horses ·
   Money · Documents & Deals · Operations · Settings. Rename any.
8. Member Schedule merge: /app/schedule folds into the member calendar view. Confirm.
9. Tenant suspend confirmation (pending #9): Commit tier 1. Recommend yes.
10. Your five daily paths: I built the flow maps on an assumed five (run the day · bookings ·
    complete-and-paid · people · documents). Correct the list and the wave order follows it.

Items already ruled and simply inherited (not re-asked): D19 fix held for the refactor; public
shopping kept; rebuild order booking-first (matches ORCH3's recommendation #5); D21 editor;
record_signature anonymous-door and DEPENDENT minors questions stay with the orchestrator thread —
they're engine/legal, not UI, and nothing here blocks on them.

---

## ORCH3 note, 2026-08-24 — see the README in this directory

This document is superseded in material ways by the newer thread's ADMIN-IA.md /
ADMIN-PAGE-SPECS.md / ADMIN-WAVES.md / PROGRESSION-PLAN.md (one level up). Ruling #1 is resolved
(TASK-AUTHORITY ran 2026-08-22/23). Ruling #5 is resolved (D27 confirms evaluations stay put,
contradicting this document's own flow-map finding). Rulings #4, #8, #9 are out of scope under
the newer, narrower admin-only scope. Rulings #2, #3, #6, #7, #10 remain genuinely open or were
implicitly superseded by the newer rail shape (#7 in particular — the newer docs use 4 nested
zones, not this document's flat 8-area list; the owner confirmed the 4-zone shape 2026-08-24).
