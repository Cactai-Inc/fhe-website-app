# TASK-DASHBOARDS-F — ELEMENT CONFIG: the per-element editor (inputs · display variant · show on dashboard), per account, from a tenant default (CODR profile) — GATED on escalation 4

**Thread:** `FHE-TASK-DASHBOARDS-F` · **Profile:** CODR · **Bundle:** B7 · **Sender / hand back to:** `FHE-MGMT-DASHBOARDS` · worktree assigned by MGMT · branch `task/dashboards-f` from `origin/main`. **Spec author:** `FHE-TASK-DASHBOARDS-A`, 2026-09-03. Model/effort: MGMT decides (D45).

**MUST MERGE BEFORE:** B (tables + RPCs), D (the panel it extends), E1 (the first elements with >1 variant and with inputs — before E1 the editor has nothing to edit). **DISPATCH ONLY WHEN the owner has answered escalation 4 "in force?"** (`docs/reports/FHE-DSNR-DASHBOARDS-HANDOFF.md` §6.4) — MGMT pastes his ruling under §1b. If he rules element config is NOT owner-editable in v1, this chunk is not run and the tables' account rows are written only by consumers' migrations and the Team page; say so in the bundle report. **THE CONTRACT BINDS:** §3.1 (`inputs`, `variants`), §4.2. ⚠️ **THE SHAPE in §8 needs the owner's eyes.**

## 1. THE OWNER'S WORDS
- CR-112·A1 #11: *"per-item toggle 'show on dashboard'"* · *"TWO config surfaces — DASHBOARD CONFIG (what is shown, where) and ELEMENT CONFIG (inputs feeding the element + display variant …)"* · *"per-ACCOUNT provisioning from a general default, changes saved to the account not the tenant"* · *"Recent entries: useful to the owner, useless to Claire (hence per-account)."*
- D13 (2026-08-12): *"i dont want to come back here every time i need to modify something and im not going to climb into the db or git either."* — and its recorded exception is about **arrangement only**: *"this exception is about dashboard/zone arrangement only, not about content or rules."* Element config is content/formula → D13 applies (the boundary escalation 4 confirms).
### 1b. THE RULING (pasted by MGMT)
_(pending)_

## 2. WHAT WAS MEASURED (2026-09-03; re-run after B/D/E1)
| Fact | Where | Value |
|---|---|---|
| Tables/RPCs | B's migration: `dashboard_element_config`, `my_element_config`, `set_element_config`, `set_element_default` | re-measure `proacl`, RLS |
| Elements with config today | `ELEMENTS.filter(e => e.inputs?.length \|\| e.variants.length > 1)` after E1 | expected: `REV_MONTH`, `REV_BY_OFFERING`, `ORIGIN_MIX`, `NEW_CLIENTS` (+ B5's when it lands) |
| The panel | D's `DashboardsPanel.tsx` | the host for this editor (a fifth section) |
| Admin-only editor precedent | `AdminEditorPage.tsx` + `SharedListSurface.tsx` (`/app/ops/admin/editor`, TASK-SURFACEEDITOR) | the app's config-editing idiom (a list with inline edit); not this bundle's file — copy the idiom, not the component, unless it is exported for reuse (measure) |

## 3. THE INCUMBENT, NAMED (D18)
B's tables and RPCs (no new DB) · D's panel (extended) · `SharedListSurface`'s idiom · the `lookup_options` labels for variants (`display_variant`) and periods (`dashboard_period`).

## 4. WHAT TO BUILD
- **Per-element control on the board** (the primary door, A1 #11's "one click away"): every element card/tile gets a small `⋯` affordance (staff only) opening an inline popover: **Show on dashboard** (switch → `shown`) · **Display** (select over the element's `variants`, labels from `display_variant`; **vs total** switch when `vsTotal`) · **Inputs** — one field per `InputDef` (`period` → the `dashboard_period` select + custom dates; `int` → number; `ref[]` → a picker over the named ref — for `resource` B5 supplies the picker; the engine ships `horse`/`contact`/`offering` pickers via existing list reads, measure which exist) · footer *Reset to default* (deletes the account row's fields → NULL, i.e. falls through to the tenant default) · *Save*. Writes `set_element_config(auth.uid(), dashboardKey, elementKey, patch)`; the element re-fetches with the merged config.
- **Hidden elements are not lost**: the panel (D) gains a section **"Elements on this dashboard"** listing every element listed on the current dashboard with its `shown` state — the way a hidden element is found and turned back on (D17: a captured preference with no surface that shows it is unfinished).
- **Tenant defaults** (admin only): the same popover carries **"Make this the default for everyone"** → `set_element_default(...)` with the same patch — explicit, never implicit (contract §4.2: two RPCs so the surface cannot write the wrong row).
- **Tell**: after Save the card re-renders with the new variant and a one-line *Saved for you* / *Saved as the default* note that fades; the popover closes.

## 5. THE TRAPS
- **Account, not tenant**: the popover's default write is the account row; the tenant-default write is a separate, labelled button; VRFY calls both on production as `hello@` and reads `user_id`.
- **Nested components eat keystrokes** — the popover has inputs; hoist every piece.
- **`ref[]` pickers must read real lists** (D17) — no free-text ids.
- **A patch key outside `{shown, variant, vs_total, inputs}` raises** (B) — the client never sends `order`/`position` (arrangement is ruled out).
- **CR-111** in labels.
- **Supabase errors are not `Error`.**

## 6. OUT OF SCOPE
Zone arrangement of any kind (ruled out) · new elements · reports · anything in `AdminEditorPage.tsx`.

## 7. WHAT YOU OWN / MUST NOT TOUCH
**Own:** `src/components/app/dashboard/ElementConfigPopover.tsx` (new), `DashboardChrome.tsx` (`Zone`/`Tile` gain the `⋯` slot), `DashboardsPanel.tsx` (the elements section), `api-dashboard.ts` (append). **DB:** none. **Not yours:** B's RPC bodies (if a patch key must widen, STOP and report — the contract has consumers).

## 8. THE SHAPE — owner's eyes
A card's header gets `⋯` at the far right (staff only, 24px hit area). The popover (anchored, 320px; full-width sheet on mobile): title = the element's title · *Show on dashboard* switch · *Display* select (`Raw total · Totals over months · Component matrix · Pie · Stacked bar · Line`) + *vs total* switch when offered · *Inputs* fields (e.g. *Period: Last month ▾*, *Months: 6*, *Items: [Feed — Timothy pellets ×] [+ add]*) · footer *Reset to default* · *Save* · admin-only link *Make this the default for everyone*. States: saving (button busy) · saved (note) · error (inline) · read-only for a non-staff viewer (no `⋯` at all).

## 9. THE TEST THIS MUST PASS
1. Browser as `hello@`: on Sales's `REV_MONTH` set *Display: Line*, *Months: 3* → Save → the card renders a 3-month line; production `SELECT user_id, variant, inputs FROM dashboard_element_config WHERE element_key='REV_MONTH'` shows her `user_id`, `'line'`, `{"months":3}`; no `user_id IS NULL` row changed. Reset to default → her row's fields NULL → the card renders the tenant default.
2. As `admin@`: *Make this the default for everyone* on the same element → a `user_id IS NULL` row; `hello@`'s (reset) card follows it.
3. Hide an element → it disappears; the panel's *Elements on this dashboard* lists it as hidden; turn it back on there.
4. A `USER` account sees no `⋯`.
5. `typecheck` · `lint` · `build`.

## 10. WHERE THE REPORT GOES
`docs/reports/TASK-DASHBOARDS-F-REPORT.md`; two-line close to `FHE-MGMT-DASHBOARDS`. Read-only on production beyond the owner's own rows on the owner's own accounts (reversed before close); never `~/Desktop`; delete nothing; stage explicit paths; do not push; no subagents; TEARDOWN.
