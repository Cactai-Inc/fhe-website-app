# FHE-TASK-DASHBOARDS-A — LEDGER

**Thread:** `FHE-TASK-DASHBOARDS-A` · profile `DSNR` · worktree `wt-8` · branch `task/dashboards-a` from `origin/main` @ `84e3a960`.
**Spec:** `docs/tasks/TASK-DASHBOARDS-A-shape-the-dashboard-engine.md` · **Bundle:** `docs/orch/BUNDLE-DASHBOARDS.md` (B7) · **hand back to** `FHE-MGMT-DASHBOARDS`.

---

## RESUME
- **STATE:** DONE 2026-09-03. Report at `docs/reports/TASK-DASHBOARDS-A-REPORT.md`; handoff at `docs/reports/FHE-DSNR-DASHBOARDS-HANDOFF.md`. Hand back to `FHE-MGMT-DASHBOARDS`. Branch `task/dashboards-a` (wt-8), not pushed.
- **CONTRACT: STABLE @ 44f7ec24** (`docs/design/DASHBOARD-ENGINE-CONTRACT.md`). MGMT lifts this one file into `bundle/dashboards` and sends it UP. `## CHANGES` is empty. Consumer interface §9 is `AWAITING B5 RECONCILE`.
- **SPECS:** `docs/tasks/TASK-DASHBOARDS-B-the-engine.md` · `-C-reports.md` · `-D-the-door.md` · `-E-boards.md` (E1/E2/E3 + STOP) · `-F-element-config.md` (gated on escalation 4).
- **RESIDUALS DONE:** plan §REVISITED appended; DAYSHEET archived (`docs/archive/…`, pointer left); FIX6 disposition = handoff §8.
- **CLNR:** clean at docs root; non-§2a folders reported, not moved (11 live worktrees). Resumability PASS.
- **NEXT (MGMT):** read the handoff → lift the contract UP → summon the owner ONCE with handoff §4 (six points; shapes in §9) → dispatch B first (merge lane) → C/D/E1/E2 with the two named collisions serialised → STOP for Claire's Ops list → E3; F after escalation 4.
- **KEY FACTS (2026-09-03, prod):** two owner accounts exist (admin@=business, hello@=trainer, both ADMIN, same org) · 17 registry rows/16 keys · 22 dash_* fns, no anon · `_waiting_items`+2 wrappers live, 0 callers, 0 migrations on main → RETIRED IN PLACE · `reports` bucket exists empty; files=2 org-owned · pg_cron absent; GH Actions hourly job succeeding · no tenant tz column · `AdminRegistryPage` is super-admin-only · `AppLayout.tsx` nav is hand-written · dash_today_plan has no time filter (DAYSHEET residual = unbuilt advance).

## LOG
- **2026-09-03** — D36 guard: `wt-8` detached at `7fcf2188`, `git status --porcelain` = 0 lines. `git fetch origin && git checkout -b task/dashboards-a origin/main` (`84e3a960`), `git clean -xdf -e node_modules -e .env -e .env.db` (nothing to clean). Ledger opened.
- **2026-09-03** — CLNR pass (report-only, see RESUME). Read bundle, CR-107, CR-112·A1 + proposed list, CR-113/114, held plan, DASHBOARDBUILD report §9, FIX6 §2b/§3/build order, DASHFEED §3/§4b/§5, 04-OPEN §1–3, HOMESHAPES, DAYSHEET §3/§7, D13/17/18/19/21/26/32/39/43, MODEL-CHOICE §09-03, registry/landing/windows/Chrome/OwnerDashboard/DashboardHome/TeamPage/grants/files/documentPdf/api-payments CSV/cronAuth/deliver-my-document/notifications-nudge/workflow. Production measured read-only (queries in the contract).
- **2026-09-03** — `docs/design/DASHBOARD-ENGINE-CONTRACT.md` written and committed alone (DRAFT).
- **2026-09-03** — specs B, C, D, E, F written and committed; contract amended (`_waiting_items` retired in place) and flipped STABLE @ `44f7ec24`; plan §REVISITED appended; DAYSHEET archived with a pointer; handoff written; report written. TEARDOWN: nothing started, nothing to kill.
