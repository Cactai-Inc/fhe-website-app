# FHE-TASK-DASHBOARDS-A — LEDGER

**Thread:** `FHE-TASK-DASHBOARDS-A` · profile `DSNR` · worktree `wt-8` · branch `task/dashboards-a` from `origin/main` @ `84e3a960`.
**Spec:** `docs/tasks/TASK-DASHBOARDS-A-shape-the-dashboard-engine.md` · **Bundle:** `docs/orch/BUNDLE-DASHBOARDS.md` (B7) · **hand back to** `FHE-MGMT-DASHBOARDS`.

---

## RESUME
- **STATE:** contract written and committed on its own (DRAFT). All §2 reads done; all §5 measurements run (recorded in the contract §1/§4 and below). Specs not yet written.
- **CONTRACT:** DRAFT @ the commit "the dashboard engine contract (DRAFT)". Flip to STABLE after the spec set confirms no name moves.
- **CLNR:** docs root 0 loose files; non-§2a folders pre-exist under docs/ (contract-content, contract-exports, proposed, staged, ui-orders) — REPORTED, not moved (11 worktrees live; CLNR §3 never moves under a running thread). Resumability: ORCH/DISCO/TASK/CLNR/MGMT/DSNR role files all present → PASS.
- **NEXT:** specs B (ENGINE) · C (REPORTS) · D (DOOR) · E (BOARDS) · F (CONFIG editor, gated) → plan REVISITED section → DAYSHEET archive → handoff → report → flip STABLE.
- **KEY FACTS (2026-09-03, prod):** two owner accounts exist (admin@=business, hello@=trainer, both ADMIN, same org) · 17 registry rows/16 keys · 22 dash_* fns, no anon · `_waiting_items`+2 wrappers live, 0 callers, 0 migrations on main · `reports` bucket exists empty; files=2 org-owned · pg_cron absent; GH Actions hourly job succeeding · no tenant tz column · lookup_options 5 keys · config_keys namespaces ORG/BRAND/CONTACT/PROPERTY · dash_today_plan has no time filter (DAYSHEET residual = unbuilt advance).

---

## LOG
- **2026-09-03** — D36 guard: `wt-8` detached at `7fcf2188`, `git status --porcelain` = 0 lines. `git fetch origin && git checkout -b task/dashboards-a origin/main` (`84e3a960`), `git clean -xdf -e node_modules -e .env -e .env.db` (nothing to clean). Ledger opened.
- **2026-09-03** — CLNR pass (report-only, see RESUME). Read bundle, CR-107, CR-112·A1 + proposed list, CR-113/114, held plan, DASHBOARDBUILD report §9, FIX6 §2b/§3/build order, DASHFEED §3/§4b/§5, 04-OPEN §1–3, HOMESHAPES, DAYSHEET §3/§7, D13/17/18/19/21/26/32/39/43, MODEL-CHOICE §09-03, registry/landing/windows/Chrome/OwnerDashboard/DashboardHome/TeamPage/grants/files/documentPdf/api-payments CSV/cronAuth/deliver-my-document/notifications-nudge/workflow. Production measured read-only (queries in the contract).
- **2026-09-03** — `docs/design/DASHBOARD-ENGINE-CONTRACT.md` written and committed alone (DRAFT).
