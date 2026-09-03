# TASK-DASHBOARDS-A — REPORT (DSNR profile: contract + spec set + chunk declaration; no build)

**Branch** `task/dashboards-a` (wt-8) off `origin/main` @ `84e3a960` · committed, **not pushed** · **read-only against production** (`lrstswfxfsezdmvkvukc`) · Fable 5.1 · effort HIGH · no subagents · **CLNR: clean at docs root (0 loose files); drift reported, not moved** (non-§2a folders `contract-content, contract-exports, proposed, staged, ui-orders` pre-exist under `docs/`; 11 worktrees live — CLNR §3 forbids moving under running threads; resumability PASS for every role file).

## 1. HEADLINE
The engine contract is written and **STABLE @ `44f7ec24`** (`docs/design/DASHBOARD-ENGINE-CONTRACT.md`) — B5 can build against §9 now. Five specs (B ENGINE · C REPORTS · D DOOR · E BOARDS in three sub-chunks with FIX6's STOP · F ELEMENT CONFIG gated on escalation 4) and the handoff with the six escalation points are on the branch. Two owner accounts exist in production — escalation 1 is closed by evidence. `_waiting_items` is retired in place, not reused (D18 + the half-measure rule).

## 2. WHAT THE TASK ASKED FOR, ITEM BY ITEM (task §1)
| # | Deliverable | Where | State |
|---|---|---|---|
| 1 | `docs/design/DASHBOARD-ENGINE-CONTRACT.md` — committed on its own FIRST (`74c502c1`, DRAFT), amended once (`_waiting_items`), flipped STABLE (`44f7ec24`) | design/ | **DONE** — `CONTRACT: STABLE @ 44f7ec24` in the ledger's RESUME |
| 2 | Spec set `TASK-DASHBOARDS-{B,C,D,E,F}` with THE SHAPE for the dashboards page, the selector, the report modal, the company documents page, a lens page, the element popover | tasks/ | **DONE** — every §8 flagged "owner's eyes before build" |
| 3 | `docs/reports/FHE-DSNR-DASHBOARDS-HANDOFF.md` — §1 chunks · §2 contention · §3 model table · §4 ASK-OWNER · §5 decisions · §6 escalation evidence (one section per point) · §7 consumer interface · §8 FIX6 disposition · §9 shapes | reports/ | **DONE** |
| 4 | Chunk declaration: files, DB objects, must-merge-before, disjoint pairs, why-one-not-two | handoff §1 | **DONE** |
| 5 | This report + the ledger | reports/ | **DONE** |
| §2.3 | `DASHBOARDS-GROUND-UP-PLAN.md` revisited — `## REVISITED 2026-09-03` table; superseded by the contract | design/ | **DONE** |
| §2.8 | DAYSHEET residual check + archive | `docs/archive/TASK-DAYSHEET-…md`; pointer at the old path | **DONE** — residual FOUND (Today does not advance: `dash_today_plan` → `lesson_plans_for_day(current_date)`, no time filter) → spec E §4a.3 |

## 3. THE FACTS RE-MEASURED (task §5) — each with its query; all in the contract §1/§4 and the specs' §2
- **Owner accounts:** 2 distinct tenant ADMIN logins (`admin@`→`business`, `hello@`→`trainer`), both signed in within 3 days; `admin@cactai.io` SUPER_ADMIN org NULL. *(profiles ⋈ auth.users, contract §4.1)*
- **`dashboard_focus` CHECK** `('trainer','business')`; `set_dashboard_focus` self-or-admin; one caller `TeamPage.tsx` via `api-dashboard.ts:341`; session key `fhe.dashboard.view`.
- **ZONES:** 17 rows / 16 keys (N1 twice); 11 trainer, 6 business. C3 and B1 are the money fact twice (`claim` ≡ `declared`).
- **`_waiting_items` (9,640 chars) + `dash_waiting_on_you/clients`:** live, `proacl` authenticated only, 0 callers, 0 migrations on main. **Decision: retire in place** (contract §1).
- **`dash_activity_readback`:** retained; not registered (ACTIVITY-LOG's four conditions unmet).
- **Report sink:** `files`/`file_links` columns, CHECKs, 8 policies; 2 org-owned files; `reports` bucket exists, empty, no policies; `my_documents()` reads `documents` only and is **anon-executable** (`proacl` has `anon=X` — not this bundle's; flagged §6). `documents`: 81 EXECUTED / 2 DRAFT / 1 AWAITING — frozen.
- **PDF:** `src/lib/documentPdf.ts` + `api/_lib/documentPdf.ts` (pdf-lib). **CSV:** `revenueLinesToCsv` (`api-payments.ts:447`) only.
- **Schedulers:** `pg_cron` absent; GitHub Actions `scheduled-jobs.yml` succeeding hourly (6/6 latest runs; `booking_reminder_1h` last 2026-09-02 12:03 -07); Vercel crons declared, not relied on.
- **Timezone:** no column anywhere; DB `America/Los_Angeles`; `calendar-reminders.ts` hardcodes it; `windows.ts` browser time → `OPS.TIMEZONE` in the value registry (contract §5.2).
- **`lookup_options`:** 5 keys; `add_lookup_value` allowlist; `config_keys` 22 keys in 4 namespaces; **the tenant's registry editor is super-admin-only** (`AdminRegistryPage`, `App.tsx:484`) → the engine's settings editor ships in chunk D (this bundle's file).
- **Landing:** `useStaffLanding` untouched; the door is `/app/dashboard` (`mgmt.dashboard` row exists). **The rail is hand-written** (`AppLayout.tsx:495`, no registry import) → a new page's nav row is an escalation (handoff §6.6.1).
- **B5's interface:** `FHE-DSNR-SUPPLIES-HANDOFF.md` absent from `origin/main` and `origin/bundle/supplies`; wt-4 holds only its ledger → contract §9 `AWAITING B5 RECONCILE`.

## 4. THE REACH · THE TELL (TASK-ROLE §6.3/§3b) — for the things this task CAPTURED
This task captured no value in the app. It captured decisions: each is **seen** in the contract and its spec, **acted on** by MGMT (dispatch) and the owner (the batched summons, handoff §4), and what nobody asked for is **presented** in handoff §5 (proposals) and §6.6 (file escalations) before "done".

## 5. FLAGGED, NOT FIXED
1. `my_documents()` is executable by `anon` (`proacl` `{=X, anon=X, …}`) — outside this bundle; route to whoever owns the document spine / a VRFY sweep.
2. `AppLayout.tsx` does not read `pageRegistry.ts` — every new staff page needs a hand edit (RECONCILED Q7 already knows; B10).
3. `AdminRegistryPage` is `requireSuperAdmin` — the tenant has no editor for any non-BRAND/PROPERTY config key. D13 gap for every existing `ORG`/`CONTACT` key, not only ours. B10/CR-110 territory.
4. `_waiting_items` and its two wrappers exist only in production (no migration) — left (D32); recorded in the contract so nobody rebuilds them.
5. `contacts.client_origin` / `contact_channel` populated count not re-measured here (expected ~0 pending the owner's backfill) — spec E §2 orders the re-measure.
6. The C3/B1 money duplication and the non-advancing Today zone are live UX debts today; both fixed in E1 §4a.

## 6. WHAT I DECIDED THAT THE SPEC DID NOT — handoff §5 (thirteen decisions), summarised
Retire `_waiting_items` in place · provisions as a row table (not `text[]`) · keep `trainer`/`business` keys · client-side generation, one commit RPC · bytes in `facility-files` (not the `reports` bucket) · never a `documents` row · freshness = consumer triggers + lazy check · `OPS.TIMEZONE` with the editor on the dashboards panel · SHOW_EMPTY as a setting · the DAYSHEET residual is an element behaviour (passed = start time; no tomorrow) · ask axis declared per element · plan superseded with a REVISITED table · escalate, never quietly edit, the four out-of-ownership files.

## 7. WHERE THE SPEC (the task doc) WAS WRONG OR STALE
- §1.1 and §5 bullet 4 lean toward reusing `_waiting_items` ("if reused, the chunk that adopts them must land their definition") — the measurement shows reuse would be a second read path beside five registered readers with no act on its rows; retired instead, reason in the contract.
- §5 "DASHBOARDBUILD reported 16; DASHFEED counted 17" — both right: 16 keys, 17 rows.
- §2.6 says 04-OPEN §1 is "not this bundle's" — agreed and restated; nothing to build.
- The bundle's escalation 1 framing ("if production has ONE owner login") — production has two; closed by evidence.
- §9 trap "no cron but the hourly GitHub Actions job has ever fired" — still true, and it is succeeding today; the report machinery's core needs no scheduler.

## 8. `typecheck` · `typecheck:api` · `lint` · `build`
Not run — this task changed no code (docs only, `git diff --stat origin/main..HEAD -- src api supabase` = 0 files).

## 9. THE OWNER'S RENDER CHECKLIST (for MGMT's summons — the shapes he must see before any build)
1. Spec C §8 — Monthly report button · generate modal (params / inclusions / confirm / success) · Company documents page.
2. Spec D §8 — dashboard header (cycler + `Dashboards…`) · "Your dashboards" modal · Team block.
3. Spec E §8 — a lens page · Today with NEXT UP / Coming up / Done today.
4. Spec F §8 — the per-element `⋯` popover (only if escalation 4 = in force).

## 10. TEARDOWN CENSUS
No server, browser, test runner or scratch worktree was started by this thread. `ps` on `vite|vitest|node … wt-8|psql|playwright` → none of mine (the only matches are the owner's own Google Chrome processes). `psql` sessions were one-shot and closed. `wt-8` stays on `task/dashboards-a`, porcelain clean, 9 commits ahead of `origin/main`, not pushed.

## VALIDATION — FHE-MGMT-DASHBOARDS, 2026-09-03
**Verdict: HOLDS (docs-only DSNR output; no VRFY thread — MGMT re-ran the headline claims itself).**
- **Re-run on production (read-only, MGMT's own queries):** two distinct tenant ADMIN logins with `dashboard_focus` seeded (`admin@`→business, `hello@`→trainer; `admin@cactai.io` SUPER_ADMIN, no org) — escalation 1 CLOSED-BY-EVIDENCE · `_waiting_items`, `dash_waiting_on_you`, `dash_waiting_on_clients` `proacl` = postgres/authenticated/service_role (no anon); no creating migration on `main` (grep) · `my_documents` `proacl` carries `anon=X` — FLAGGED, routed to ORCH (GRANTS/B1 territory) · 12 buckets, `reports` present and empty · `files`: 2 rows, both org-owned · `dashboard_provisions` / `reports` do not exist yet · `profiles_dashboard_focus_chk` present.
- **Merge audit (ORCHESTRATOR §6):** diff against merge-base `84e3a960` touches no `src/`, `api/`, `supabase/` file; dry-run merge into `bundle/dashboards` clean (0 conflicts); "flagged, not fixed" read — items 1–4 routed to ORCH in MGMT's hand-back, items 5–6 are inside specs E1/E2.
- **Contract read in full by MGMT before sending UP.** One note for the CODR of B: `UNIQUE … NULLS NOT DISTINCT` needs PG15+ — spec B §5 already carries the fallback.
- **Merge commit:** `9fcd6e6b` on `bundle/dashboards` (ORCH merges the bundle branch to `main`).

