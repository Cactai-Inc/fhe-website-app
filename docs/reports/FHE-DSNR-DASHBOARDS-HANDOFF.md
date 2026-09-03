# FHE-DSNR-DASHBOARDS — HANDOFF (from `FHE-TASK-DASHBOARDS-A`, DSNR profile, to `FHE-MGMT-DASHBOARDS`)

**Date:** 2026-09-03 · **Branch:** `task/dashboards-a` (wt-8), from `origin/main` @ `84e3a960` · **Contract:** `docs/design/DASHBOARD-ENGINE-CONTRACT.md` — **STATUS: STABLE** (see the ledger's RESUME for the commit) · **Specs:** `docs/tasks/TASK-DASHBOARDS-{B,C,D,E,F}-*.md` · **Plan revisited:** `docs/design/DASHBOARDS-GROUND-UP-PLAN.md` §REVISITED · **DAYSHEET archived** with a pointer at its old path.

**One line for ORCH, lifted first:** the contract is STABLE; B5 can build against §9 now. Its own interface section (`FHE-DSNR-SUPPLIES-HANDOFF.md` §7) had not landed on `origin/main` or `bundle/supplies` when this was written — contract §9 is marked `AWAITING B5 RECONCILE`.

---

## 1. THE CHUNKS, IN DEPENDENCY ORDER (DSNR-ROLE §5.1; chunk declaration per the task §1.4)

| Chunk | Spec | Must merge before it | Owns — files | Owns — DB objects | Why ONE chunk | Disjoint from |
|---|---|---|---|---|---|---|
| **B — ENGINE** | `TASK-DASHBOARDS-B-the-engine.md` | nothing (branch from main) | `src/lib/dashboard/registry.ts` (types + adapter), `src/lib/ops/api-dashboard.ts`, `OwnerDashboard.tsx` (default-view resolution + SHOW_EMPTY read), `TeamPage.tsx:255-300` only, `test/db/dashboard_engine.test.ts`, one migration | `dashboard_provisions`, `dashboard_element_config`, `my_dashboards`, `set_dashboard_provision`, `set_dashboard_default`, `my_element_config`, `set_element_config`, `set_element_default`, `period_bounds`, `set_dashboard_focus` (rewrite), DROP `profiles_dashboard_focus_chk`, `config_keys/values` rows (`OPS.TIMEZONE`, `DASHBOARDS.SHOW_EMPTY`), `lookup_options` rows (`dashboard_period`, `display_variant`), `add_lookup_value` allowlist | The CHECK drop, the seed of the two live rows and the provisions table are one transaction (NOSTRIP); the registry widening and the RPCs are one interface B5 builds against — splitting them leaves a half-interface | everything (it is first) |
| **C — REPORTS** | `TASK-DASHBOARDS-C-reports.md` | B | `src/lib/dashboard/{reports,reportBody,csv,reportFiles}.ts`, `GenerateReportModal.tsx`, `CompanyDocumentsPage.tsx`, `App.tsx` (one route line), `pageRegistry.ts` (one row), `OwnerDashboard.tsx` header (the button), `test/db/reports.test.ts`, one migration | `reports` + sequence/trigger/index, `generate_report`, `mark_reports_outdated`, `report_freshness_check`, `list_reports`, `company_documents`, `element_config_for`, `config_keys` row `REPORTS.NAME_TEMPLATE` | Generation, storage, naming/supersession and the page that lists them are one state machine (idempotency and renaming are proven together, task §9 trap) | D by DB object (D adds none); **collides with D on `OwnerDashboard.tsx`'s header** |
| **D — DOOR** | `TASK-DASHBOARDS-D-the-door.md` | B | `DashboardChrome.tsx` (toggle→cycler), `DashboardsPanel.tsx` (new), `OwnerDashboard.tsx` header, `api-dashboard.ts` (append), `TeamPage.tsx:255-300` | none new (writes `config_values` rows; B's RPCs) | The cycler, the selector and the Team editor are three doors to one table; the tenant-settings editor rides the same panel (D13 for B's keys) | C by DB; E by DB and by renderer files; **collides with C on the header** |
| **E1 — BOARDS: shared fixes + Sales + Marketing** | `TASK-DASHBOARDS-E-boards.md` §4a–§4b | B (D for the reach — the lens must be holdable; MGMT may run E1 in parallel with D and test reach after D merges) | `registry.ts` E1 block, `TrainerZones.tsx` (Today, Money), `SalesZones.tsx`, `MarketingZones.tsx`, `charts/*` (new), `DashboardChrome.tsx` (`Tile.pending`), `OwnerDashboard.tsx` renderer map E1 block, `test/db/dashboards_e1.test.ts`, migrations | `dash_money`, `sales_*`, `marketing_*` RPCs; provisions seed rows for `admin@` | The money convergence and the Today advance are debts every lens inherits; Sales and Marketing are FIX6's step 2 as one deliverable the owner reviews together | E2 by DB and renderer files; **collides with E2 on `registry.ts` and the renderer map (fenced blocks; E1 first)** |
| **E2 — BOARDS: Admin desk** | same spec §4c | B | `registry.ts` E2 block, `AdminDeskZones.tsx`, `OwnerDashboard.tsx` renderer map E2 block, migrations `admin_*`, `test/db/dashboards_e2.test.ts` | `admin_*` RPCs; provisions seed row | Independent of the STOP (FIX6 step 4) | E1 (see left) |
| **STOP** | — | E1 merged and seen by the owner | — | — | FIX6 step 3: *"ASK FOR CLAIRE'S OPS LIST"* — a real pause | — |
| **E3 — BOARDS: Ops composed** | same spec §4d (stub) | B, D, E1, E2, **the owner's list** | `OpsBoard.tsx` (new), `registry.ts` E3 block | none | Composition is one renderer | everything else |
| **F — ELEMENT CONFIG editor** | `TASK-DASHBOARDS-F-element-config.md` | B, D, E1, **escalation 4's ruling** | `ElementConfigPopover.tsx` (new), `DashboardChrome.tsx` (`⋯` slot), `DashboardsPanel.tsx` (elements section), `api-dashboard.ts` | none | One popover, two writers (account/default), one list of hidden elements | C, E2, E3 |
| **RESIDUALS** | done in A | — | `DASHBOARDS-GROUND-UP-PLAN.md` §REVISITED; DAYSHEET archived; FIX6 disposition = §7 below | — | docs only | — |

**Parallel lanes MGMT may run:** `B` alone → then `{C, D, E1, E2}` with the two named collisions serialised (D before C on the header; E1 before E2 on the registry) → `STOP` → `E3` · `F` after escalation 4. **Merge lane (bundle):** B first as one unit (B5 builds against it); each later chunk after its VRFY.

**GATED/ESCALATED work not in any chunk until ORCH assigns files:** `api/deliver-report.ts` (email a report), `api/reports-monthly.ts` + a workflow row (auto-generation), the `AppLayout.tsx` rail row for the company documents page, the day-before reminder/deadline (B11). See §6.6.

## 2. CONTENTION I CAN SEE (§5.2)
- `OwnerDashboard.tsx` header: C (Monthly report button) and D (cycler + `Dashboards…`). One file, two chunks.
- `registry.ts` + the renderer map: E1 and E2 (and B5 when it registers its elements — **B5's registry block is the first cross-bundle contention on this file; MGMT-DASHBOARDS and MGMT-SUPPLIES must serialise appends or agree a fenced-block convention — contract §9 prescribes one fenced block per bundle**).
- `TeamPage.tsx:255-300`: B (options from held set) then D (held-set editor). Same block, sequential.
- `pageRegistry.ts`: C adds one row; B10 owns the nav; B5's CR-110 access-point rows touch the same file (RECONCILED) — one-line appends, low risk, named.
- `config_keys/config_values`: B, C add rows; B5 may add its own; additive.
- Production DB is shared by every worktree (D35): B's migration drops a CHECK on `profiles` — no other running bundle writes `dashboard_focus` (grep: only TeamPage), but MGMT should announce the apply.

## 3. MODEL AND EFFORT PER CHUNK — recommendation (D45: MGMT decides; the Fable allowance is the constraint)
| Chunk | Recommend | Why |
|---|---|---|
| B | Opus · HIGH · thinking ON | build inside a locked shape; migration + RLS + adapter refactor with a byte-identical render test — judgment, not ambiguity |
| C | Opus · HIGH · ON | the largest chunk; state machine + two renderers + a new page; shape is locked |
| D | Opus · HIGH · ON (Sonnet · HIGH · ON acceptable — it is mostly UI over B's RPCs) | |
| E1 | Opus · HIGH · ON | the money convergence is subtractive and the RPCs are new reads over revenue — correctness matters |
| E2 | Sonnet · HIGH · ON | measurable reads, one renderer file, idiom already set by E1 |
| E3 | Opus · HIGH · ON — after the list | composition rules from DASHFEED; judgment |
| F | Sonnet · HIGH · ON | a popover over existing RPCs |
| VRFY (per merge) | Opus · HIGH · ON with production queries | contract §4 (account not tenant), §7.1 idempotency, §7.3 renaming on regeneration, `proacl` on every new function |
| WALKR (close) | Opus · HIGH · ON | the dashboards page as each owner account · generate a monthly report · the supersede path; FLOW-MAP F15 (document delivery, for the report file) and F18 (account); WALKTEST fixture never a real client |

## 4. ASK-OWNER — batched, most-blocking first (the six pre-registered points; evidence in §6)
1. **(Point 4) Element config vs D13 — "in force?"** Recommendation: YES, owner-editable per account (contract §4.2; chunk F). Blocks F only; B ships the tables regardless.
2. **(Point 2) The metric list.** Against the element frame in §6.2: which of the listed classes does he want on Sales / Marketing, and does he have the chat-thread list? Blocks E1's CONTENT (the honest set builds without it).
3. **(Point 6a) The seven view names and the "Admin" collision.** Recommendation: keys `sales · marketing · admin_desk · ops · trainer · instructor · caretaker`; labels his — for the lens that collides with the nav section, **"Admin desk"** (or "Company"). Blocks E2's label only.
4. **(Point 6b) Does Marketing exist before any campaign data?** Recommendation: YES, with `ORIGIN_MIX` as its one real element and the rest honestly "not yet measurable" — an empty lens that says why is a door to a plan, not to nothing. If NO, E1 registers Sales only.
5. **(Point 5) The company documents page — name and place.** Recommendation: **"Company documents"**, Management group, `/app/ops/company-documents`; NOT under Admin (the nav collision FIX6 raised) and NOT a Records tab (Records → Documents is the contract-document ledger; co-mingling is the thing #12 forbids). Blocks C's label; C can build with the recommendation if he defers.
6. **(Point 6c) Does a CLIENT dashboard/report ship in this bundle?** Recommendation: NO — the engine holds one (`audience:'member'`); HOMESHAPES specs it as a consumer later. Blocks nothing.
7. **(Point 1) Two owner accounts — CLOSED-BY-EVIDENCE** (§6.1). No question unless he wants a per-PERSON layer under a shared login (recommendation: no; provisioning follows the login).
8. **(Point 3) DASHFEED's three questions — §1 and §2 ANSWERED in the file; §3 = ask 2.** Nothing to ask.
9. **Ops list (FIX6 step 3)** — not now; after E1 ships. MGMT summons a second time for this one only; the bundle pre-registered six points and this is FIX6's own STOP, not a seventh.

## 5. WHAT I DECIDED THAT THE BUNDLE DID NOT (§5.5) — said aloud
1. **`_waiting_items` / `dash_waiting_on_*` RETIRED IN PLACE, not reused** (contract §1). D18 (five registered readers already own its facts) and the half-measure rule (its rows carry no act). The bundle's item 3 said "decide reuse-or-retire"; this is the decision and its reason. No migration is landed for them.
2. **Provisioning is a ROW TABLE, not `profiles.dashboard_views text[]`** (FIX6 recommended the array). A row carries who/when/revoked (D19/D32), the tenant default is the same table with `user_id NULL` (so "from a general default" falls out), and it copies the app's one provisioning idiom (`instructor_surface_grants`). `dashboard_focus` retained as the landing preference, as FIX6 said.
3. **`'trainer'`/`'business'` keys survive** as the two live dashboards; the seven FIX6 views are ADDED beside them. Whether "CJ's Dashboard" later becomes the Admin desk or dissolves into the lenses is the owner's, after he sees Sales/Marketing (ask 3 can carry it).
4. **Report generation runs in the client and commits in one RPC** (contract §7.3). The registry is code; the DB cannot enumerate elements; the browser already holds the rendered data — which is literally "the dashboard as it appears to them". Server-side generation is the GATED auto-run's shape, not the button's.
5. **Report bytes live in `facility-files` as org-owned `files` rows, not in the empty `reports` bucket** — zero new storage policies; the bucket is left (D32).
6. **A report is never a `documents` row** (the freeze) — the company documents page reads `documents` for company-party documents only.
7. **Backdated-data detection = consumer triggers + a lazy freshness check** (contract §7.4) — no trigger on tables this bundle does not own, no scheduler in the guarantee.
8. **The month boundary is `OPS.TIMEZONE` in the value registry (fallback `America/Los_Angeles`)** — the DAYSHEET ruling made data; and **its editor is on the dashboards panel (chunk D)** because the tenant's only registry editor is super-admin-only (`AdminRegistryPage`, `requireSuperAdmin`) — measured, not assumed.
9. **DASHFEED's "everything visible" testing posture is `DASHBOARDS.SHOW_EMPTY`**, a setting (his word was "temporarily"); it was never built.
10. **The DAYSHEET residual exists** (Today does not advance) and is an element behaviour in E1, with two decisions stated there: passed = start time; tomorrow never shows on Today.
11. **The ask axis (`yours/theirs/today`) is declared per element**, not computed; the composed Ops board clusters by it.
12. **The plan is superseded by the contract**, with a REVISITED table saying where each section went; §5's substrate and §1's suggestion engine are proposals (below), not specs.
13. **The three engine-level settings and the `AppLayout.tsx` rail row are escalations, not quiet edits** (§6.6).

**Proposals (NOT in any CR — listed, not specced):** the tasks/reminders/goals substrate (plan §5; FIX6 §4 projects/tasks) · the error-report inbox (FIX6 §5) · the assigned-helper badge (FIX6) · a campaigns record (Marketing's real input) · `kpi_daily`-style trend history beyond report snapshots · a scheduled freshness sweep (contract §7.4) · the Lesson Workspace (plan §4).

## 6. THE ESCALATION EVIDENCE — one section per point: *what exists today · the diff · recommendation*

### 6.1 Two owner accounts? — CLOSED-BY-EVIDENCE
**Exists:** two distinct tenant ADMIN logins in production — `admin@fhequestrian.com` (`dashboard_focus='business'`, last sign-in 2026-09-01 15:48 -07) and `hello@fhequestrian.com` (`'trainer'`, last sign-in 2026-08-31 10:59 -07); same `org_id`; `admin@cactai.io` is the platform SUPER_ADMIN (org NULL). Query: contract §4.1. HOMESHAPES §3 §1b measured the same two on 2026-08-24. The "shared-login audit gap" is that actor stamps under `hello@` cannot say WHICH PERSON acted (Claire rescheduled from an iPhone session under `hello@`, 2026-08-25) — it is not that there is one login.
**Diff:** none — "per-account for Claire and myself" has two accounts. If CJ sometimes works under `hello@`, he sees Claire's provisioned set there; provisioning follows the login.
**Recommendation:** no per-person layer. Option B (a per-person profile under one login) would need a second identity model the rebuild (D30, multi-tenant) already plans; not here. **Mark CLOSED.**

### 6.2 The metric list (M2) — framed against the element list
**Exists:** he said a list exists in a Claude chat (04-OPEN §3); it never arrived. **Registerable from live data today** (each with its input): revenue by month / by offering (`revenue_summary`, `revenue_period_lines`) · declared-unconfirmed total (`dash_money_health`) · unpaid aging · new clients per month (contact → account promotion — measure the stamp) · lessons per week/month, week fill (`dash_trainer_kpis`) · people waiting + oldest age · deals by stage (`dash_deals_contracts`) · onboarding stuck (`dash_onboarding_pipeline`) · catalog gaps (`dash_catalog_hygiene`) · send failures per log · cron last-effect · client origin/channel mix (`contacts.client_origin/contact_channel` — **captured as columns, populated ~0 until his backfill; re-measure**).
**Cannot be computed today — and why (a zero here would be a lie):** website traffic and sessions (no `page_events`; B4/CR-106) · form submissions → conversion rate ($ per form, $ per conversion) (inquiries are captured in `requests`; the promotion to a client is not stamped against the request — measure `requests` → `contacts` linkage; if absent, not computable) · $ per client (computable as revenue ÷ paying clients for a period — say so; it is cheap) · run rate / burn rate / months cash on hand (revenue side computable; **the cost side does not exist until B5's ledger and the recurring fixed costs land** — CR-112·A1 #4/#14) · campaign results (no campaign record).
**The single ask:** "Here is what the engine can show now and what it cannot yet and why. Which of these go on Sales, which on Marketing, and is there a list from the chat thread to add?"

### 6.3 DASHFEED's three owner questions — restated verbatim, and their state
- **§1 MESSAGING** — 04-OPEN §1 quoted: *"are you asking if we remove messaging as a feature? … we can make the notes sections into proper message chat thread interfaces and then enumerate them in the user's messages page. Or, we can leave the messaging only on the action surfaces and kill the collective messages page. im impartial, i just want to give everyone what they will actually use."* → **ANSWERED** (ruling quoted in the file): *"the idea of having the messages on a single collected surface page is that you can then one click to the original surface … you decide."* → **ONE STORE, THREE VIEWS; build it; sequenced AFTER T3.** Not this bundle's; the engine only needs an `action` element that can render a thread inline (contract §10).
- **§2 THE TWO DASHBOARD VIEWS** — quoted: *"no, they are wildly different, hers are all about the lessons, the requests, the schedule, and the clients. the money is the only overlap we share. mine is all about the kpis like the giant list i shared. and then we both need to see different notifications…"* → **ANSWERED: the two boards STAY (two roles); money, invite-claimed, contract-signed render on BOTH as one element each** — spec E §4a.1–2.
- **§3 THE DASHBOARD NUMBERS** — quoted: *"I cant tell you, but i know there is an answer to this and a smart ai chat thread will have a list … lets get a new spec document from that thread and then implement it"* and *"conversion rates, number of form submissions, $ per website form submitted, $ per client, $ per conversion, are likely not ready to be calculated because the inputs are most likely not fully or properly implemented."* → **OPEN = point 2.** The point collapses into 6.2.

### 6.4 Element-config vs D13 — the boundary, in three rows
| Surface | What it edits | D13 status | This bundle |
|---|---|---|---|
| **The selector** (which dashboards an account holds; landing default) | ACCESS | **Allowed** — CR-107's own note: access control is not arrangement | Chunk D |
| **Element config** (per element: inputs · display variant · show-on-dashboard; per account from a tenant default) | CONTENT / FORMULA — which figures feed a number and how it is shown | **D13 applies** — the exception is *"about dashboard/zone arrangement only, not about content or rules"* (CLAUDE.md D13). CR-112 #11 asks for it explicitly | Tables in B; editor in **F, gated on his word** |
| **Zone arrangement** (order · pin · hide-by-preference) | ARRANGEMENT | **Ruled out, not deferred** (owner 2026-08-22) | Never — `shown` is a content choice ("show this figure"), not a position; no `order`/`position` column exists |
**Recommendation:** in force — element config is owner-editable per account. **The one question:** *"Per-element inputs and display variant, editable by you and Claire each on your own account, with a tenant default you set — in force?"*

### 6.5 The company documents page — name and place
**Exists:** *My Documents* (`my_documents()`, the member's contract documents — kind `pending/assigned/executed`; DealHome and the account page read it) · *Records → Documents* (staff; the tenant's contract-document ledger) · *Records → Files* (`FilesRecordsPage`, every uploaded file in the tenant, org- and contact-owned together) · *My Files* (a member's own uploads) · *Content store* (company uploads, `owner_kind='org'`) · the Admin nav section (Moderation · Field options · Content store · Settings). **No surface lists reports** (none exist) and **no surface shows only company-owned things**.
**Diff:** a fourth documents-ish surface is needed because #12's rule is about ownership (company vs client), which none of the existing lists is cut by.
**Recommendation:** ONE new page, **"Company documents"**, Management group (beside Dashboard, Calendar, Support, Payment review), `/app/ops/company-documents`, three lists + Archived (contract §7.5). Not under **Admin** (FIX6's collision: "go to Admin" already means the nav section, and this page is daily work, not tenant configuration); not a Records tab (Records is the ledger of client-facing records). Name alternatives if he prefers: "Business documents", "French Heritage Equestrian — documents" (D43's business-sense form is the org name; "Company" is not a banned word). ⚠️ The rail row needs `AppLayout.tsx` (B10) — §6.6.

### 6.6 What CR-107 / CR-112 cannot settle — and the file/DB escalations for ORCH
**ASK-OWNER (in §4):** view names + Admin collision (rec. "Admin desk") · Marketing before campaign data (rec. yes) · client dashboard/report in this bundle (rec. no) · CJ's Dashboard's fate after the lenses exist (carry with ask 3).
**ESCALATIONS TO ORCH (files/objects outside this bundle's ownership — MGMT routes; nothing was specced around silently):**
1. `src/components/app/AppLayout.tsx` `MANAGEMENT_GROUP` — one row for the company documents page. The nav is hand-written (does not read `pageRegistry.ts`; measured `:495-535`); without it the page is reachable only from dashboard headers and the modal. Ask B10 to apply the one-line diff C's report will carry.
2. `api/deliver-report.ts` (new) — "email + store": authenticated self-send of a stored report PDF/CSV, `deliver-my-document.ts`'s shape. C ships store-only with the email control disabled-with-reason until assigned.
3. `api/reports-monthly.ts` (new) + one line in `.github/workflows/scheduled-jobs.yml` (and `vercel.json` for parity) — auto-generation on the 1st for dashboards without manual inputs; server-side rendering via `api/_lib/documentPdf.ts`. GATED until assigned.
4. The day-before reminder and the one-minute deadline — B11 (CR-113); the engine writes a `notifications` row from #3's endpoint.
5. `AdminBrandingPage.tsx` / `AdminRegistryPage.tsx` — NOT needed after all: D ships the tenant editor for the three engine keys on the dashboards panel (this bundle's file). Recorded so nobody re-raises it.
6. **Cross-bundle contention on `registry.ts`:** B5 will append its dashboard/elements; the fenced-block convention in contract §9 is the rule — ORCH should tell MGMT-SUPPLIES.

## 7. THE CONSUMER INTERFACE (task §7) — contract §9, verbatim pointer
Read `docs/design/DASHBOARD-ENGINE-CONTRACT.md` §9 (register a dashboard · register an element · declare per-account defaults · contribute figures and a per-entity statement · what the generator calls · backdated data · reach). **B5's side: `AWAITING B5 RECONCILE`** — `FHE-DSNR-SUPPLIES-HANDOFF.md` §7 was not on `origin/main` or `origin/bundle/supplies` on 2026-09-03 (measured: `git show` → path does not exist; `wt-4`'s branch holds only its ledger). When it lands, differences go under the contract's `## CHANGES` with the consumer re-reading; the likeliest friction points, pre-empted in §9: the element source signature (`(p_from, p_to, p_inputs)` → `{count, items, figures, not_yet_measurable}`), the two chart data shapes, the per-account default as a tenant-default row, and `mark_reports_outdated` from B5's ledger trigger.

## 8. FIX6 DISPOSITION (bundle item 8 — one line for the bundle report)
`TASK-FIX6-ops-and-sales.md` is ABSORBED: its held-views SET model, seven views in two families, Ops-composed rule and build order are the provisioning model and chunk sequence of this handoff (contract §4, spec E); its error-report button, assigned-helper badge and projects/tasks list carry no CR and are listed as proposals (§5). Do not run it as written.

## 9. SHAPES THAT NEED THE OWNER'S EYES BEFORE BUILD (§5.6)
- Spec C §8 — the "Monthly report" button, the generate modal (parameters / inclusions / confirm / success), the company documents page.
- Spec D §8 — the dashboards page header (cycler + `Dashboards…`), the "Your dashboards" modal (held · land on · for everyone · defaults), the Team block.
- Spec E §8 — a lens page (numbers strip by domain, pending tiles, chart cards with the matrix modal, action clusters); Today's NEXT UP / Coming up / Done today.
- Spec F §8 — the per-element `⋯` popover.
Render checklist up before merge (bundle §Gates); anything a client would see is none of these (no client surface ships in this bundle — ask 6).
