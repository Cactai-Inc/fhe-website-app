# TASK-DASHBOARDS-D — THE DOOR: the cycler, the selector on the dashboards page, the Team page's held-set editor, the two tenant settings (CODR profile)

**Thread:** `FHE-TASK-DASHBOARDS-D` · **Profile:** CODR · **Bundle:** B7 `docs/orch/BUNDLE-DASHBOARDS.md` · **Sender / hand back to:** `FHE-MGMT-DASHBOARDS` · **Worktree:** assigned by MGMT · branch `task/dashboards-d` from `origin/main`. **Spec author:** `FHE-TASK-DASHBOARDS-A` (DSNR), 2026-09-03. Model/effort: MGMT decides (D45).

**MUST MERGE BEFORE THIS:** `TASK-DASHBOARDS-B`. **DISJOINT FROM:** C (reports) by file and by DB object — C touches `OwnerDashboard.tsx`'s header (the Monthly report button) and D touches the same header (the cycler + selector) → **one file, two chunks: MGMT serialises D before C or has C rebase; say which in the dispatch line.** **THE CONTRACT BINDS:** §2 rule 5, §4.3, §5.2. ⚠️ **THE SHAPE in §8 needs the OWNER'S EYES before build** (bundle §Gates: the dashboards page and the selector are standards every later dashboard inherits).

**Zeroth act:** CLNR pass. **First act:** `docs/reports/FHE-TASK-DASHBOARDS-D-LEDGER.md`. **Second act:** re-run §2.

## 1. THE OWNER'S WORDS
- CR-107 (2026-09-02): *"…there are a lot of different ones and i can enable them as accessible for claire and myself and we can choose which ones we want to have accessible from the dashboards page using a selector of some kind?"* — and ORCH's note there: *a WHICH-DASHBOARDS-ARE-ACCESSIBLE selector is access control, not arrangement — it is not excluded by [the D13 exception].*
- FIX6 §2b: *"two dashboard configs so they can be toggled or only one is selected (by admin for a staff, ie: role scoped)"* · *"In my admin portion of the app i need to have the ability to provision any user's view, this applies to me and to claire. and when things are mutually exclusive we can use a toggle when both are enabled."* · *"cycle through strict views of sales, marketing, ops, admin"* → **a cycler, not a binary toggle.**
- Owner 2026-08-23 (on the toggle): *"it's not even a secondary action... it doesn't need to be a full size UI element."* Owner 2026-08-23 (labels): *"They should just say Claire's Dashboard, CJ's Dashboard."*
- D26: *the dashboard is the LANDING SURFACE, shown on a fresh login and after ~30 minutes away — not a page you navigate to.*
- **Reconciliation (this task's, said aloud):** FIX6's held-views SET and CR-107's "selector" are ONE requirement — the words that survive are FIX6's (*provisioned to an account, any number; the toggle appears only when an account holds more than one*); CR-107's selector is the self-service door on the dashboards page to the same rows; the Team page is the admin's door to any account. One table (`dashboard_provisions`), two doors.

## 2. WHAT WAS MEASURED (2026-09-03; re-run)
| Fact | Where | Value |
|---|---|---|
| The toggle | `DashboardChrome.tsx` `ViewToggle` (one peek button, "Show X's Dashboard" / ✕); `OwnerDashboard.tsx:62` `SESSION_VIEW_KEY='fhe.dashboard.view'`, `:129 chooseView` | two-way; never writes the stored default |
| The landing | `src/lib/dashboard/landing.ts` `useStaffLanding` | `/app` → `/app/dashboard` once per sign-in; 30-min re-land; staff only |
| The Team control | `TeamPage.tsx:255-300` "Default dashboard" select (`trainer`/`business`) → `setDashboardFocus` (`api-dashboard.ts:341`) | the only writer of `dashboard_focus`; the panel's `onChanged` closes it (`:176-182` comment) — this control deliberately does not go through `run()` |
| The grants panel idiom | `TeamPage.tsx:463` `GRANTABLE_SURFACES.map(…)` checkboxes → `addGrant/removeGrant` (`grants.ts`) | per-account checkbox list — the shape the held-set editor copies |
| Nav row | `pageRegistry.ts:234 mgmt.dashboard`; `AppLayout.tsx:507` hand-written `{ to:'/app/dashboard', label:'Dashboard' }` | the door already has a row; nothing to add |
| Tenant settings without an editor | `AdminRegistryPage` is `requireSuperAdmin` (`App.tsx:484`); `AdminBrandingPage` lists `BRAND`/`PROPERTY` only | **`OPS.TIMEZONE`, `DASHBOARDS.SHOW_EMPTY`, `REPORTS.NAME_TEMPLATE` (if C has merged) have no tenant editor → this chunk ships it (§4c)** |
| Held sets after B | `SELECT u.email, dashboard_key, user_id IS NULL AS tenant_default FROM dashboard_provisions …` | expected: hello@→trainer, admin@→business, defaults trainer+business (re-measure after B) |

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE
`ViewToggle` → becomes the cycler (same element, widened) · the Team "Default dashboard" block → widened to held SET + landing default · `GRANTABLE_SURFACES` checkbox idiom → copied for the selector · `config_values` upsert (`src/lib/api.ts:2115-2156`) → the settings writes. **Nothing greenfield except the "Dashboards…" panel component.**

## 4. WHAT TO BUILD
### 4a. The cycler (`DashboardChrome.tsx` `ViewToggle` → `DashboardCycler`)
- Props: `held: DashboardDef[]` (from `my_dashboards()` joined to `DASHBOARDS`), `value`, `home` (the landing key), `onChange`. **Renders nothing when `held.length < 2`** (FIX6). For `held.length === 2` renders exactly today's shape (peek button + ✕). For `> 2`: the same small pill showing the CURRENT dashboard's label with a chevron; click → a menu listing `held` in registry order (lenses, then roles), the home one marked; choosing one calls `onChange`; a "Back to mine" row when `value !== home`. Keyboard: arrow keys cycle. Never writes `dashboard_focus`.
- Session memory unchanged (`fhe.dashboard.view`); a remembered key not in `held` is ignored (B already does this — verify).
### 4b. The selector (`DashboardsPanel.tsx`, new, `src/components/app/dashboard/`)
- A small "Dashboards…" control beside the cycler (renders even when one dashboard is held — it is how a second gets enabled). Opens a `Modal`: **"Your dashboards"** — every `audience:'staff'` `DashboardDef` as a row: label · one-line description (a new optional `DashboardDef.hint`) · a checkbox *Held*; `composed` dashboards show *"composed from the others you hold"*. Toggling calls `set_dashboard_provision(auth.uid(), key, held)`; the cycler updates live. **A non-admin staff account sees the same rows read-only** (`set_dashboard_provision` is self-or-admin so they COULD self-provision — decide: the contract says self-service is allowed for the signed-in account; keep it self-service for all staff, and say so). A second section **"Land on"**: a select over the held set → `set_dashboard_focus` (the existing RPC, now validating against held).
- **Guard**: un-holding the LAST held dashboard is refused in the UI (*"Keep at least one"*) — the RPC still allows it (an admin may empty an account from Team; the account then lands on the tenant defaults per contract §2 rule 5).
### 4c. The tenant settings, on the same panel (admin only, third section **"For everyone"**)
- `OPS.TIMEZONE` (a select of IANA names — `Intl.supportedValuesOf('timeZone')` with a fallback list), `DASHBOARDS.SHOW_EMPTY` (a switch: *Show every element, even when empty — testing posture*), `REPORTS.NAME_TEMPLATE` (a text input with the three tokens listed; only if C has merged — else omit and say so). Writes via the existing `config_values` upsert idiom in `src/lib/api.ts` (import; do not duplicate). A note under the timezone: *"Month and period boundaries follow this. The live week/month tiles follow your browser."*
- **Tenant defaults for new accounts** (`set_dashboard_default`): a fourth section **"Defaults for new staff accounts"** — the same rows as 4b with checkboxes; admin only.
### 4d. The Team page block (`TeamPage.tsx:255-300` ONLY)
- Replace the two-option select with: the held SET (checkboxes, `dashboards_for(member)` from B → `set_dashboard_provision(member, key, held)`) + *Lands on* (select over the member's held set → `setDashboardFocus`). Keep the block's own "does not go through `run()`" behaviour and its inline *Saved.* note (the reason is in the file's comment; do not fix the panel-closing defect — it is B10's Q11d).
### 4e. Landing (`landing.ts` — do NOT edit) — verify only: `/app` → `/app/dashboard` → `OwnerDashboard` opens `dashboard_focus` if held, else the first held. That logic is B's; this chunk tests it (§9.4).

## 5. THE TRAPS
- **Per-account config lands on the ACCOUNT** (CR-112 #11): the selector calls `set_dashboard_provision(auth.uid(), …)` — never `set_dashboard_default`; VRFY proves the row's `user_id` on production after a real toggle by `hello@`.
- **Two chunks, one header** (`OwnerDashboard.tsx`): C adds the Monthly report button to the same `<header>`; rebase, do not re-implement.
- **The nested-component keystroke trap**: the panel has inputs (template text, timezone search) — every sub-component at module scope.
- **Supabase errors are not `Error`** — `useAsync.ts` / `toErrorMessage`.
- **A control that reports success and does nothing** (grants.ts's Oversight note; TASK-ROLE §2a): every toggle re-reads `my_dashboards()` after the write and renders from the read, never from optimistic state alone.
- **The TeamPage panel closes on `run()`** (`:176-182`) — this block stays outside `run()`.
- **D13**: the three settings have NO other editor for the tenant — if this chunk slips, the ENGINE's keys are unfinished; say so in the report if any field is omitted.
- **CR-111 banned words** in any new label/copy: no "Stable/Barn/Program/…"; the org name in business-sense copy is "French Heritage Equestrian".

## 6. OUT OF SCOPE
Any new dashboard (E) · element config UI (F) · reports (C) · `landing.ts` · `AppLayout.tsx` · the rest of `TeamPage.tsx` · `AdminBrandingPage`/`AdminRegistryPage`.

## 7. WHAT YOU OWN / MUST NOT TOUCH
**Own:** `src/components/app/dashboard/DashboardChrome.tsx` (the toggle → cycler), `src/components/app/dashboard/DashboardsPanel.tsx` (new), `src/pages/app/ops/OwnerDashboard.tsx` (header only), `src/lib/ops/api-dashboard.ts` (append), `TeamPage.tsx:255-300` (the one block), `test/…` for the panel if a component test harness exists (measure). **DB:** none new (B's RPCs; `config_values` rows). **Not yours:** everything else.

## 8. THE SHAPE — owner's eyes before build
**8.1 Header row of `/app/dashboard`**: `Good morning, CJ` (h1) · right side, one small pill **`CJ's Dashboard ▾`** (the cycler; hidden when one dashboard is held; the two-held case is today's *Show Claire's Dashboard* / ✕) · beside it a smaller text control **`Dashboards…`**. On mobile the row wraps below the greeting (as today).
**8.2 The cycler menu**: rows in registry order — *Sales · Marketing · Admin desk · CJ's Dashboard ✓ (lands here) · Ops*; the composed one last; *Back to mine* when peeking.
**8.3 "Your dashboards" modal** (medium): section **Held** — one row per staff dashboard: `[✓] Sales — revenue, conversion, traffic` … ; section **Land on** — select; admin-only sections **For everyone** (timezone select · show-empty switch · name template) and **Defaults for new staff accounts** (checkbox rows). Footer: *Done*. Every write confirms inline (*Saved*) and the cycler updates behind the modal. Error: inline under the row. Empty case: impossible (the registry always has two).
**8.4 Team → member panel → "Dashboards" block**: `Held: [✓] Claire's Dashboard  [ ] Sales …` · `Lands on: (select)` · *Saved.* inline.
**States:** loading (skeleton rows) · saved · error · read-only (non-admin sees checkboxes disabled in the admin sections with *"Ask an owner to change this"*).

## 9. THE TEST THIS MUST PASS
1. Browser as `admin@`: `/app/dashboard` shows the pill only if ≥2 held (after B's seed, admin@ holds one → no pill; open *Dashboards…* → hold *Claire's Dashboard* → the pill appears; cycle; ✕ returns).
2. Production (read-only after the toggle in 1): `SELECT u.email, dashboard_key, revoked_at FROM dashboard_provisions p JOIN auth.users u ON u.id=p.user_id WHERE u.email='admin@fhequestrian.com'` shows the new row with `user_id = admin@`'s id; `SELECT count(*) FROM dashboard_provisions WHERE user_id IS NULL` unchanged from B's seed.
3. Un-hold the last one → the UI refuses with *Keep at least one*.
4. Landing: sign out, sign in as `hello@`, land on `/app/dashboard` on Claire's board; set *Land on* to another held board; sign out/in → lands there. Deep link `/app/calendar` never redirected.
5. `SHOW_EMPTY` switch off → the board self-hides and the footer names absences; on → every element renders. Timezone changed to `UTC` → `period_bounds('last_month')` (B's function, `SELECT` on production) moves; set it back to `America/Los_Angeles` **in the same session** (never leave production changed).
6. Team → hello@'s panel → hold *Sales* (if E has merged; else *CJ's Dashboard*) → her cycler shows it on next load.
7. A `USER`-role WALKTEST account never sees the pill, the panel or `/app/ops/team`.
8. `typecheck` · `typecheck:api` · `lint` · `build`.

## 10. WHERE THE REPORT GOES
`docs/reports/TASK-DASHBOARDS-D-REPORT.md`; two-line close to `FHE-MGMT-DASHBOARDS`. Read-only against production (the toggles above are the owner's own rows on the owner's own account and are reversed before close — say so in the report); never `~/Desktop`; delete nothing; stage explicit paths; do not push; no subagents; TEARDOWN.
